"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Minus, Trash2, Loader2, PackageSearch, AlertTriangle, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────

interface Product {
  id: number;
  name: string;
  sku: string;
  unit: string;
  threshold: number;
  current_stock: number;
  is_below_threshold: boolean;
}

// ── Shared overlay ─────────────────────────────────────────────────────────

function Overlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    />
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="text-xs text-slate-500 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2.5 bg-[#1a2520] border border-[rgba(34,197,94,0.15)] rounded-lg text-white text-sm focus:outline-none focus:border-brand-500/50 placeholder-slate-600";

const dangerInputCls =
  "w-full px-3 py-2.5 bg-[#1a1010] border border-red-500/20 rounded-lg text-white text-sm focus:outline-none focus:border-red-500/50";

// ── New Product Modal ──────────────────────────────────────────────────────

const UNITS = ["kg", "ton", "liter", "unit", "adet", "çuval", "kutu"];

interface NewProductModalProps {
  onCancel: () => void;
  onConfirm: (data: { name: string; sku: string; unit: string; threshold: number }) => void;
}

function NewProductModal({ onCancel, onConfirm }: NewProductModalProps) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("kg");
  const [threshold, setThreshold] = useState<number | "">(0);

  const valid = name.trim() && sku.trim() && unit && Number(threshold) >= 0;

  const handleSubmit = () => {
    if (!valid) return;
    onConfirm({ name: name.trim(), sku: sku.trim().toUpperCase(), unit, threshold: Number(threshold) });
  };

  return (
    <>
      <Overlay onClose={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative bg-[#111a14] border border-brand-500/20 rounded-xl p-6 w-full max-w-md shadow-2xl">
          <div className="flex items-center gap-2 mb-5">
            <PackagePlus size={18} className="text-brand-400" />
            <h2 className="text-white font-semibold">Yeni Ürün Ekle</h2>
          </div>

          <Field label="Ürün Adı">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn. Buğday"
              className={inputCls}
            />
          </Field>

          <Field label="SKU (Stok Kodu)">
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="örn. WHEAT-002"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Birim">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={inputCls + " cursor-pointer"}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u} className="bg-[#111a14]">
                    {u}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Kritik Eşik">
              <input
                type="number"
                min="0"
                step="0.1"
                value={threshold}
                onChange={(e) =>
                  setThreshold(e.target.value === "" ? "" : parseFloat(e.target.value))
                }
                placeholder="0"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              İptal
            </button>
            <button
              disabled={!valid}
              onClick={handleSubmit}
              className="flex-1 py-2 text-sm font-semibold text-white bg-brand-600/80 rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-40"
            >
              Oluştur
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Delete Confirmation Modal ──────────────────────────────────────────────

interface DeleteModalProps {
  product: Product;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteModal({ product, onCancel, onConfirm }: DeleteModalProps) {
  return (
    <>
      <Overlay onClose={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative bg-[#111a14] border border-red-500/25 rounded-xl p-6 w-full max-w-sm shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 size={16} className="text-red-400" />
            <h2 className="text-white font-semibold">Ürünü Sil</h2>
          </div>
          <p className="text-slate-400 text-sm mb-1">
            <span className="text-red-400 font-medium">{product.name}</span> ürünü ve
            tüm stok hareketleri kalıcı olarak silinecek.
          </p>
          <p className="text-slate-600 text-xs mb-6">
            Bu işlem geri alınamaz.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2 text-sm font-semibold text-white bg-red-600/70 rounded-lg hover:bg-red-600 transition-colors"
            >
              Kalıcı Olarak Sil
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Add Stock Modal ────────────────────────────────────────────────────────

interface AddStockModalProps {
  product: Product;
  onCancel: () => void;
  onConfirm: (qty: number) => void;
}

function AddStockModal({ product, onCancel, onConfirm }: AddStockModalProps) {
  const [qty, setQty] = useState<number | "">(1);

  return (
    <>
      <Overlay onClose={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative bg-[#111a14] border border-brand-500/20 rounded-xl p-6 w-full max-w-sm shadow-2xl">
          <h2 className="text-white font-semibold mb-1">Stok Ekle</h2>
          <p className="text-slate-400 text-sm mb-5">
            <span className="text-brand-400 font-medium">{product.name}</span> için
            eklenecek miktarı girin.
          </p>
          <Field label={`Miktar (${product.unit})`}>
            <input
              autoFocus
              type="number"
              min="0.1"
              step="0.1"
              value={qty}
              onChange={(e) =>
                setQty(e.target.value === "" ? "" : parseFloat(e.target.value))
              }
              onKeyDown={(e) =>
                e.key === "Enter" && qty && Number(qty) > 0 && onConfirm(Number(qty))
              }
              className={inputCls}
            />
          </Field>
          <div className="flex gap-3 mt-2">
            <button onClick={onCancel} className="flex-1 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
              İptal
            </button>
            <button
              disabled={!qty || Number(qty) <= 0}
              onClick={() => onConfirm(Number(qty))}
              className="flex-1 py-2 text-sm font-semibold text-white bg-brand-600/80 rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-40"
            >
              Ekle
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Remove Stock Modal ─────────────────────────────────────────────────────

interface RemoveStockModalProps {
  product: Product;
  onCancel: () => void;
  onConfirm: (qty: number) => void;
}

function RemoveStockModal({ product, onCancel, onConfirm }: RemoveStockModalProps) {
  const [qty, setQty] = useState<number | "">(1);

  return (
    <>
      <Overlay onClose={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative bg-[#111a14] border border-red-500/25 rounded-xl p-6 w-full max-w-sm shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="text-white font-semibold">Stok Azalt</h2>
          </div>
          <p className="text-slate-400 text-sm mb-1">
            <span className="text-red-400 font-medium">{product.name}</span> stoğundan
            miktar düşecek. Bu işlem{" "}
            <span className="text-yellow-400">30 saniye içinde geri alınabilir</span>.
          </p>
          <p className="text-slate-600 text-xs mb-4">
            Mevcut stok: {product.current_stock} {product.unit}
          </p>
          <Field label={`Azaltılacak miktar (${product.unit})`}>
            <input
              autoFocus
              type="number"
              min="0.1"
              max={product.current_stock}
              step="0.1"
              value={qty}
              onChange={(e) =>
                setQty(e.target.value === "" ? "" : parseFloat(e.target.value))
              }
              onKeyDown={(e) =>
                e.key === "Enter" && qty && Number(qty) > 0 && onConfirm(Number(qty))
              }
              className={dangerInputCls}
            />
          </Field>
          <div className="flex gap-3 mt-2">
            <button onClick={onCancel} className="flex-1 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
              İptal
            </button>
            <button
              disabled={!qty || Number(qty) <= 0}
              onClick={() => onConfirm(Number(qty))}
              className="flex-1 py-2 text-sm font-semibold text-white bg-red-600/70 rounded-lg hover:bg-red-600/90 transition-colors disabled:opacity-40"
            >
              Azalt
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Mini stock bar ─────────────────────────────────────────────────────────

function StockBar({ current, threshold }: { current: number; threshold: number }) {
  const max = Math.max(current, threshold) * 1.4 || 1;
  const pct = Math.min((current / max) * 100, 100);
  const thPct = Math.min((threshold / max) * 100, 100);
  const critical = current < threshold;

  return (
    <div className="relative h-1.5 bg-slate-800 rounded-full w-24 overflow-visible">
      <div
        className={clsx(
          "absolute left-0 top-0 h-full rounded-full transition-all duration-500",
          critical ? "bg-red-500" : "bg-brand-500"
        )}
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-yellow-400/70 rounded-sm"
        style={{ left: `${thPct}%` }}
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type Modal = "new-product" | "add-stock" | "remove-stock" | "delete" | null;

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<Modal>(null);
  const [target, setTarget] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    const res = await fetch(`${API}/api/products`);
    setProducts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const closeModal = () => { setActiveModal(null); setTarget(null); };
  const open = (modal: Modal, product?: Product) => {
    setTarget(product ?? null);
    setActiveModal(modal);
  };

  // ── API helpers ─────────────────────────────────────────────────────────

  const createMovement = async (productId: number, qty: number) => {
    const res = await fetch(`${API}/api/stock/movement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, quantity: qty, notes: "Dashboard manual" }),
    });
    return res.json();
  };

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleNewProduct = async (data: { name: string; sku: string; unit: string; threshold: number }) => {
    closeModal();
    const res = await fetch(`${API}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.status === 409) {
      toast.error(`SKU "${data.sku}" zaten kullanımda.`);
      return;
    }
    await fetchProducts();
    toast.success(`${data.name} ürün kataloğuna eklendi.`);
  };

  const handleDelete = async () => {
    if (!target) return;
    const p = target;
    closeModal();
    await fetch(`${API}/api/products/${p.id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
    toast(`${p.name} silindi.`);
  };

  const handleAddStock = async (qty: number) => {
    if (!target) return;
    const p = target;
    closeModal();
    await createMovement(p.id, qty);
    await fetchProducts();
    toast.success(`${p.name}: +${qty} ${p.unit} eklendi.`);
  };

  const handleRemoveStock = async (qty: number) => {
    if (!target) return;
    const p = target;
    closeModal();
    await createMovement(p.id, -qty);
    await fetchProducts();

    toast(`${p.name} stoğundan ${qty} ${p.unit} azaltıldı.`, {
      duration: 30000,
      action: {
        label: "Geri Al",
        onClick: async () => {
          await createMovement(p.id, qty);
          await fetchProducts();
          toast.success(`${p.name}: işlem geri alındı.`);
        },
      },
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0f0d] p-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_-5%,rgba(34,197,94,0.05),transparent)]" />

      <div className="relative max-w-5xl mx-auto">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Stok Yönetimi</h1>
            <p className="text-slate-500 text-sm mt-1">
              Ürün ekleyin, stok güncelleyin. Azaltma işlemleri 30 sn içinde geri alınabilir.
            </p>
          </div>
          <button
            onClick={() => open("new-product")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600/80 hover:bg-brand-600 border border-brand-500/30 rounded-lg transition-colors"
          >
            <PackagePlus size={16} />
            <span className="hidden sm:inline">Yeni Ürün</span>
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-600">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-700">
            <PackageSearch size={40} strokeWidth={1} className="mb-3" />
            <p className="text-sm mb-4">Ürün bulunamadı.</p>
            <button
              onClick={() => open("new-product")}
              className="text-xs text-brand-400 border border-brand-500/25 px-3 py-1.5 rounded-lg hover:bg-brand-500/10 transition-colors"
            >
              İlk ürünü ekle
            </button>
          </div>
        ) : (
          <div className="card-glow rounded-xl bg-[#111a14] border border-[rgba(34,197,94,0.08)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[rgba(34,197,94,0.08)] flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">
                Ürün Kataloğu
                <span className="ml-2 text-slate-600 font-normal text-xs">
                  {products.length} ürün
                </span>
              </h2>
              <span className="text-xs text-slate-500">
                {products.filter((p) => p.is_below_threshold).length > 0 && (
                  <span className="text-red-400">
                    {products.filter((p) => p.is_below_threshold).length} kritik
                  </span>
                )}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-[rgba(34,197,94,0.06)]">
                    <th className="text-left px-6 py-3">Ürün</th>
                    <th className="text-left px-6 py-3 hidden md:table-cell">SKU</th>
                    <th className="text-left px-6 py-3 hidden lg:table-cell">Seviye</th>
                    <th className="text-right px-6 py-3">Mevcut</th>
                    <th className="text-right px-6 py-3">Eşik</th>
                    <th className="text-right px-6 py-3">Durum</th>
                    <th className="text-right px-6 py-3">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(34,197,94,0.04)]">
                  {products.map((p) => (
                    <tr
                      key={p.id}
                      className={clsx(
                        "transition-colors hover:bg-[rgba(34,197,94,0.02)]",
                        p.is_below_threshold && "bg-[rgba(239,68,68,0.02)]"
                      )}
                    >
                      <td className="px-6 py-4 font-medium text-white">{p.name}</td>

                      <td className="px-6 py-4 hidden md:table-cell text-slate-500 font-mono text-xs">
                        {p.sku}
                      </td>

                      <td className="px-6 py-4 hidden lg:table-cell">
                        <StockBar current={p.current_stock} threshold={p.threshold} />
                      </td>

                      <td className="px-6 py-4 text-right font-mono">
                        <span className={p.is_below_threshold ? "text-red-400" : "text-brand-400"}>
                          {p.current_stock.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                        </span>
                        <span className="text-slate-600 text-xs ml-1">{p.unit}</span>
                      </td>

                      <td className="px-6 py-4 text-right text-slate-600 font-mono text-xs">
                        {p.threshold} {p.unit}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {p.is_below_threshold ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            Kritik
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                            Normal
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => open("add-stock", p)}
                            title="Stok ekle"
                            className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500/25 transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            onClick={() => open("remove-stock", p)}
                            title="Stok azalt"
                            className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/25 transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <button
                            onClick={() => open("delete", p)}
                            title="Ürünü sil"
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {activeModal === "new-product" && (
        <NewProductModal onCancel={closeModal} onConfirm={handleNewProduct} />
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
