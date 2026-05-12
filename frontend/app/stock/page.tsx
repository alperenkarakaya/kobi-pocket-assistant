"use client";

import { useState, useEffect, useCallback } from "react";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/auth";
import StockTabs from "@/components/stock/StockTabs";
import StockProductsTab from "@/components/stock/StockProductsTab";
import StockAnalyticsTab from "@/components/stock/StockAnalyticsTab";
import { NewProductModal, AddStockModal, RemoveStockModal, DeleteModal } from "@/components/stock/StockModals";
import type { Product, Supplier, TrendItem, Modal, ActiveTab, AnalyticsHistory } from "@/components/stock/types";

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [history, setHistory] = useState<AnalyticsHistory>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("products");
  const [activeModal, setActiveModal] = useState<Modal>(null);
  const [target, setTarget] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    const res = await apiFetch("/api/products");
    setProducts(await res.json());
    setLoading(false);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    const [trendRes, historyRes] = await Promise.all([
      apiFetch("/api/analytics/trends"),
      apiFetch("/api/analytics/daily-history"),
    ]);
    if (trendRes.ok) setTrends(await trendRes.json());
    if (historyRes.ok) setHistory(await historyRes.json());
    setAnalyticsLoading(false);
  }, []);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/products").then(r => r.json()),
      apiFetch("/api/suppliers").then(r => r.json()),
      apiFetch("/api/analytics/trends").then(r => r.ok ? r.json() : []),
      apiFetch("/api/analytics/daily-history").then(r => r.ok ? r.json() : []),
    ]).then(([prods, supps, trendData, historyData]) => {
      setProducts(prods);
      setSuppliers(supps);
      setTrends(Array.isArray(trendData) ? trendData : []);
      setHistory(Array.isArray(historyData) ? historyData : []);
      setLoading(false);
      setAnalyticsLoading(false);
    }).catch(() => {
      setLoading(false);
      setAnalyticsLoading(false);
    });
  }, []);

  const closeModal = () => {
    setActiveModal(null);
    setTarget(null);
  };

  const openModal = (modal: Modal, product?: Product) => {
    setTarget(product ?? null);
    setActiveModal(modal);
  };

  const createMovement = async (productId: number, qty: number) => {
    await apiFetch("/api/stock/movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, quantity: qty, notes: "Dashboard manual" }),
    });
  };

  const handleNewProduct = async (data: { name: string; sku: string; unit: string; threshold: number; supplier_id?: number; initial_stock?: number }) => {
    closeModal();
    try {
      const res = await apiFetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, sku: data.sku, unit: data.unit, threshold: data.threshold }),
      });

      if (res.status === 409) {
        toast.error(`SKU "${data.sku}" zaten kullanımda.`);
        return;
      }
      if (!res.ok) throw new Error("Ürün oluşturulamadı.");

      const newProduct: Product = await res.json();

      if (data.supplier_id) {
        await apiFetch(`/api/products/${newProduct.id}/supplier`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplier_id: data.supplier_id }),
        });
      }

      if ((data.initial_stock ?? 0) > 0) {
        await createMovement(newProduct.id, Number(data.initial_stock));
      }

      await fetchProducts();
      await fetchAnalytics();
      toast.success(
        (data.initial_stock ?? 0) > 0
          ? `${data.name} ürün kataloğuna eklendi ve ${data.initial_stock} ${data.unit} başlangıç stoğu tanımlandı.`
          : `${data.name} ürün kataloğuna eklendi.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`Hata: ${msg}`);
    }
  };

  const handleDelete = async () => {
    if (!target) return;
    const selected = target;
    closeModal();
    try {
      await apiFetch(`/api/products/${selected.id}`, { method: "DELETE" });
      setProducts(prev => prev.filter(p => p.id !== selected.id));
      await fetchAnalytics();
      toast(`${selected.name} silindi.`);
    } catch {
      toast.error("Silme işlemi başarısız. Tekrar deneyin.");
    }
  };

  const handleAddStock = async (qty: number) => {
    if (!target) return;
    const selected = target;
    closeModal();
    try {
      await createMovement(selected.id, qty);
      await fetchProducts();
      await fetchAnalytics();
      toast.success(`${selected.name}: +${qty} ${selected.unit} eklendi.`);
    } catch {
      toast.error("Stok eklenemedi. Tekrar deneyin.");
    }
  };

  const handleRemoveStock = async (qty: number) => {
    if (!target) return;
    const selected = target;
    closeModal();
    try {
      await createMovement(selected.id, -qty);
      await fetchProducts();
      await fetchAnalytics();

      toast(`${selected.name} stoğundan ${qty} ${selected.unit} azaltıldı.`, {
        duration: 30000,
        action: {
          label: "Geri Al",
          onClick: async () => {
            try {
              await createMovement(selected.id, qty);
              await fetchProducts();
              await fetchAnalytics();
              toast.success(`${selected.name}: işlem geri alındı.`);
            } catch {
              toast.error("Geri alma başarısız.");
            }
          },
        },
      });
    } catch {
      toast.error("Stok azaltılamadı. Tekrar deneyin.");
    }
  };

  const handleAssignSupplier = async (productId: number, supplierId: number | null) => {
    const res = await apiFetch(`/api/products/${productId}/supplier`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier_id: supplierId }),
    });

    if (!res.ok) {
      toast.error("Atama başarısız.");
      return;
    }

    const updated: Product = await res.json();
    setProducts(prev => prev.map(p => p.id === productId ? updated : p));
    toast.success(supplierId ? `Tedarikçi atandı: ${updated.supplier?.name}` : "Tedarikçi bağlantısı kaldırıldı.");
  };

  const critical = products.filter(p => p.is_below_threshold).length;
  const assignedCount = products.filter(p => p.supplier_id).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Stok Yönetimi</h1>
            <p className="text-slate-500 text-sm mt-1">
              {loading ? "Yükleniyor..." : `${products.length} ürün · ${critical > 0 ? `${critical} kritik` : "tüm stoklar normal"}`}
            </p>
          </div>
          <button onClick={() => openModal("new-product")} className="btn-primary">
            <PackagePlus size={15} />
            <span className="hidden sm:inline">Yeni Ürün Ekle</span>
          </button>
        </div>

        <StockTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "products" ? (
          <StockProductsTab
            products={products}
            suppliers={suppliers}
            loading={loading}
            critical={critical}
            assignedCount={assignedCount}
            onOpenNewProduct={() => openModal("new-product")}
            onAssignSupplier={handleAssignSupplier}
            onOpenAddStock={(product) => openModal("add-stock", product)}
            onOpenRemoveStock={(product) => openModal("remove-stock", product)}
            onOpenDelete={(product) => openModal("delete", product)}
          />
        ) : (
          <StockAnalyticsTab loading={analyticsLoading} trends={trends} history={history} />
        )}
      </div>

      {activeModal === "new-product" && (
        <NewProductModal suppliers={suppliers} onCancel={closeModal} onConfirm={handleNewProduct} />
      )}
      {activeModal === "add-stock" && target && (
        <AddStockModal product={target} onCancel={closeModal} onConfirm={handleAddStock} />
      )}
      {activeModal === "remove-stock" && target && (
        <RemoveStockModal product={target} onCancel={closeModal} onConfirm={handleRemoveStock} />
      )}
      {activeModal === "delete" && target && (
        <DeleteModal product={target} onCancel={closeModal} onConfirm={handleDelete} />
      )}
    </div>
  );
}
