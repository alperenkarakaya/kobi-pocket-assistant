"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Minus, Trash2, Loader2, PackageSearch, AlertTriangle, PackagePlus, X, Users } from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Supplier {
  id: number;
  name: string;
  email: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  unit: string;
  threshold: number;
  current_stock: number;
  is_below_threshold: boolean;
  daily_consumption?: number;
  days_to_empty?: number | null;
  supplier_id: number | null;
  supplier: Supplier | null;
}

// ── Modal base ─────────────────────────────────────────────────────────────

function Overlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
  );
}

function ModalShell({
  title, icon: Icon, iconClass, children, onClose,
}: {
  title: string; icon: React.ElementType; iconClass: string;
  children: React.ReactNode; onClose: () => void;
}) {
  return (
    <>
      <Overlay onClose={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl border border-slate-200 shadow-card-lg p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className={clsx("p-1.5 rounded-lg", iconClass)}>
                <Icon size={16} />
              </div>
              <h2 className="text-slate-900 font-semibold">{title}</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

const UNITS = ["kg", "ton", "liter", "adet", "çuval", "kutu", "unit"];

// ── New Product Modal ──────────────────────────────────────────────────────

function NewProductModal({
  suppliers,
  onCancel,
  onConfirm,
}: {
  suppliers: Supplier[];
  onCancel: () => void;
  onConfirm: (data: { name: string; sku: string; unit: string; threshold: number; supplier_id?: number }) => void;
}) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("kg");
  const [threshold, setThreshold] = useState<number | "">(0);
  const [supplierId, setSupplierId] = useState<string>("");
  const valid = name.trim() && sku.trim() && Number(threshold) >= 0;

  return (
    <ModalShell title="Yeni Ürün Ekle" icon={PackagePlus} iconClass="bg-brand-50 text-brand-600" onClose={onCancel}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Ürün Adı</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="örn. Buğday" className="form-input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">SKU (Stok Kodu)</label>
          <input value={sku} onChange={e => setSku(e.target.value)}
            placeholder="örn. WHEAT-001" className="form-input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Birim</label>
            <select value={unit} onChange={e => setUnit(e.target.value)} className="form-input">
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Kritik Eşik</label>
            <input type="number" min="0" step="0.1" value={threshold}
              onChange={e => setThreshold(e.target.value === "" ? "" : parseFloat(e.target.value))}
              placeholder="0" className="form-input" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tedarikçi (opsiyonel)</label>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="form-input">
            <option value="">— Seçilmedi —</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center">İptal</button>
          <button disabled={!valid}
            onClick={() => valid && onConfirm({
              name: name.trim(), sku: sku.trim().toUpperCase(), unit,
              threshold: Number(threshold),
              supplier_id: supplierId ? Number(supplierId) : undefined,
            })}
            className="btn-primary flex-1 justify-center">
            Oluştur
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Delete Modal ───────────────────────────────────────────────────────────

function DeleteModal({ product, onCancel, onConfirm }: { product: Product; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ModalShell title="Ürünü Sil" icon={Trash2} iconClass="bg-red-50 text-red-600" onClose={onCancel}>
      <p className="text-sm text-slate-600 mb-1">
        <span className="font-semibold text-slate-800">{product.name}</span> ürünü ve tüm stok hareketleri kalıcı olarak silinecek.
      </p>
      <p className="text-xs text-slate-400 mb-5">Bu işlem geri alınamaz.</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">İptal</button>
        <button onClick={onConfirm} className="btn-danger flex-1 justify-center">Kalıcı Sil</button>
      </div>
    </ModalShell>
  );
}

// ── Add Stock Modal ────────────────────────────────────────────────────────

function AddStockModal({ product, onCancel, onConfirm }: { product: Product; onCancel: () => void; onConfirm: (qty: number) => void }) {
  const [qty, setQty] = useState<number | "">(1);
  return (
    <ModalShell title="Stok Ekle" icon={Plus} iconClass="bg-brand-50 text-brand-600" onClose={onCancel}>
      <p className="text-sm text-slate-600 mb-4">
        <span className="font-semibold text-brand-700">{product.name}</span> için eklenecek miktarı girin.
      </p>
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Miktar ({product.unit})</label>
        <input autoFocus type="number" min="0.1" step="0.1" value={qty}
          onChange={e => setQty(e.target.value === "" ? "" : parseFloat(e.target.value))}
          onKeyDown={e => e.key === "Enter" && qty && Number(qty) > 0 && onConfirm(Number(qty))}
          className="form-input" />
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">İptal</button>
        <button disabled={!qty || Number(qty) <= 0} onClick={() => onConfirm(Number(qty))}
          className="btn-primary flex-1 justify-center">Ekle</button>
      </div>
    </ModalShell>
  );
}

// ── Remove Stock Modal ─────────────────────────────────────────────────────

function RemoveStockModal({ product, onCancel, onConfirm }: { product: Product; onCancel: () => void; onConfirm: (qty: number) => void }) {
  const [qty, setQty] = useState<number | "">(1);
  return (
    <ModalShell title="Stok Azalt" icon={AlertTriangle} iconClass="bg-amber-50 text-amber-600" onClose={onCancel}>
      <p className="text-sm text-slate-600 mb-1">
        <span className="font-semibold text-slate-800">{product.name}</span> stoğundan miktar düşecek.
      </p>
      <p className="text-xs text-amber-600 font-medium mb-1">Bu işlem 30 saniye içinde geri alınabilir.</p>
      <p className="text-xs text-slate-400 mb-4">Mevcut stok: {product.current_stock} {product.unit}</p>
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Azaltılacak miktar ({product.unit})</label>
        <input autoFocus type="number" min="0.1" max={product.current_stock} step="0.1" value={qty}
          onChange={e => setQty(e.target.value === "" ? "" : parseFloat(e.target.value))}
          onKeyDown={e => e.key === "Enter" && qty && Number(qty) > 0 && onConfirm(Number(qty))}
          className="form-input border-amber-300 focus:ring-amber-500" />
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">İptal</button>
        <button disabled={!qty || Number(qty) <= 0} onClick={() => onConfirm(Number(qty))}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50">
          Azalt
        </button>
      </div>
    </ModalShell>
  );
}

// ── Stock bar ──────────────────────────────────────────────────────────────

function StockBar({ current, threshold }: { current: number; threshold: number }) {
  const max = Math.max(current, threshold) * 1.4 || 1;
  const pct = Math.min((current / max) * 100, 100);
  const thPct = Math.min((threshold / max) * 100, 100);
  const ratio = threshold > 0 ? current / threshold : 1;
  const color = ratio < 0.3 ? "bg-red-500" : ratio < 0.6 ? "bg-amber-400" : "bg-brand-500";

  return (
    <div className="relative h-2 bg-slate-100 rounded-full w-24 overflow-visible">
      <div className={clsx("absolute left-0 top-0 h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${pct}%` }} />
      <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-slate-400/50 rounded-sm"
        style={{ left: `${thPct}%` }} />
    </div>
  );
}

// ── Inline supplier selector ───────────────────────────────────────────────

function SupplierCell({
  product,
  suppliers,
  onChange,
}: {
  product: Product;
  suppliers: Supplier[];
  onChange: (productId: number, supplierId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={clsx(
          "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors max-w-[140px] truncate",
          product.supplier
            ? "bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100"
            : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100"
        )}
        title={product.supplier ? `${product.supplier.name} — ${product.supplier.email}` : "Tedarikçi ata"}
      >
        <Users size={10} className="flex-shrink-0" />
        <span className="truncate">{product.supplier ? product.supplier.name : "Ata"}</span>
      </button>
    );
  }

  return (
    <select
      autoFocus
      className="text-xs border border-brand-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 max-w-[160px]"
      defaultValue={product.supplier_id ?? ""}
      onChange={e => {
        const val = e.target.value;
        onChange(product.id, val ? Number(val) : null);
        setOpen(false);
      }}
      onBlur={() => setOpen(false)}
    >
      <option value="">— Kaldır —</option>
      {suppliers.map(s => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type Modal = "new-product" | "add-stock" | "remove-stock" | "delete" | null;

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<Modal>(null);
  const [target, setTarget] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    const res = await fetch(`${API}/api/products`);
    setProducts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/products`).then(r => r.json()),
      fetch(`${API}/api/suppliers`).then(r => r.json()),
    ]).then(([prods, supps]) => {
      setProducts(prods);
      setSuppliers(supps);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const closeModal = () => { setActiveModal(null); setTarget(null); };
  const open = (modal: Modal, product?: Product) => {
    setTarget(product ?? null);
    setActiveModal(modal);
  };

  const createMovement = async (productId: number, qty: number) => {
    await fetch(`${API}/api/stock/movement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, quantity: qty, notes: "Dashboard manual" }),
    });
  };

  const handleNewProduct = async (data: { name: string; sku: string; unit: string; threshold: number; supplier_id?: number }) => {
    closeModal();
    const res = await fetch(`${API}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.name, sku: data.sku, unit: data.unit, threshold: data.threshold }),
    });
    if (res.status === 409) { toast.error(`SKU "${data.sku}" zaten kullanımda.`); return; }
    const newProduct: Product = await res.json();

    // Assign supplier if selected
    if (data.supplier_id) {
      await fetch(`${API}/api/products/${newProduct.id}/supplier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: data.supplier_id }),
      });
    }

    await fetchProducts();
    toast.success(`${data.name} ürün kataloğuna eklendi.`);
  };

  const handleDelete = async () => {
    if (!target) return;
    const p = target;
    closeModal();
    await fetch(`${API}/api/products/${p.id}`, { method: "DELETE" });
    setProducts(prev => prev.filter(x => x.id !== p.id));
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

  const handleAssignSupplier = async (productId: number, supplierId: number | null) => {
    const res = await fetch(`${API}/api/products/${productId}/supplier`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier_id: supplierId }),
    });
    if (!res.ok) { toast.error("Atama başarısız."); return; }
    const updated: Product = await res.json();
    setProducts(prev => prev.map(p => p.id === productId ? updated : p));
    toast.success(
      supplierId
        ? `Tedarikçi atandı: ${updated.supplier?.name}`
        : "Tedarikçi bağlantısı kaldırıldı."
    );
  };

  const critical = products.filter(p => p.is_below_threshold).length;
  const assignedCount = products.filter(p => p.supplier_id).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Stok Yönetimi</h1>
            <p className="text-slate-500 text-sm mt-1">
              {loading ? "Yükleniyor..." : `${products.length} ürün · ${critical > 0 ? `${critical} kritik` : "tüm stoklar normal"}`}
            </p>
          </div>
          <button onClick={() => open("new-product")} className="btn-primary">
            <PackagePlus size={15} />
            <span className="hidden sm:inline">Yeni Ürün Ekle</span>
          </button>
        </div>

        {/* Stats row */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "Toplam Ürün", value: products.length, color: "text-slate-800" },
              { label: "Kritik Stok", value: critical, color: critical > 0 ? "text-red-600" : "text-slate-800" },
              { label: "Normal", value: products.length - critical, color: "text-brand-600" },
              { label: "Tedarikçi Atanmış", value: `${assignedCount}/${products.length}`, color: assignedCount === products.length ? "text-brand-600" : "text-amber-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-4 text-center">
                <p className={clsx("text-2xl font-bold", color)}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <Loader2 className="animate-spin mr-2" size={20} />
            <span className="text-sm">Yükleniyor...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-20 text-slate-400">
            <PackageSearch size={40} strokeWidth={1.5} className="mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-500 mb-1">Ürün bulunamadı</p>
            <p className="text-sm text-slate-400 mb-5">seed.py çalıştırın veya aşağıdan yeni ürün ekleyin</p>
            <button onClick={() => open("new-product")} className="btn-primary">
              <PackagePlus size={15} />İlk Ürünü Ekle
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <h2 className="section-title">Ürün Kataloğu</h2>
              {critical > 0 && (
                <span className="badge-critical">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {critical} kritik ürün
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["Ürün / SKU", "Stok Seviyesi", "Mevcut", "Eşik", "Günlük", "Tedarikçi", "Durum", "İşlemler"].map(h => (
                      <th key={h} className={clsx(
                        "px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider",
                        h === "İşlemler" ? "text-right" :
                        ["Mevcut", "Eşik", "Günlük", "Durum"].includes(h) ? "text-right" : "text-left",
                        h === "Stok Seviyesi" && "hidden lg:table-cell",
                        h === "Günlük" && "hidden md:table-cell",
                        h === "Tedarikçi" && "hidden sm:table-cell",
                      )}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {products.map(p => {
                    const ratio = p.threshold > 0 ? p.current_stock / p.threshold : 1;
                    return (
                      <tr key={p.id} className={clsx(
                        "transition-colors hover:bg-slate-50",
                        p.is_below_threshold && "bg-red-50/30"
                      )}>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{p.sku}</p>
                        </td>

                        <td className="px-4 py-3.5 hidden lg:table-cell w-36">
                          <StockBar current={p.current_stock} threshold={p.threshold} />
                          <p className="text-[10px] text-slate-400 mt-1">
                            {Math.round(Math.min(ratio * 100, 100))}% dolu
                          </p>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <span className={clsx(
                            "font-bold text-base tabular-nums",
                            ratio < 0.3 ? "text-red-600" : ratio < 0.6 ? "text-amber-600" : "text-slate-800"
                          )}>
                            {p.current_stock.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">{p.unit}</span>
                        </td>

                        <td className="px-4 py-3.5 text-right text-slate-500 text-sm tabular-nums">
                          {p.threshold.toLocaleString("tr-TR")}
                          <span className="text-slate-400 text-xs ml-1">{p.unit}</span>
                        </td>

                        <td className="px-4 py-3.5 text-right hidden md:table-cell text-slate-500 text-xs tabular-nums">
                          {(p.daily_consumption ?? 0) > 0
                            ? <>{p.daily_consumption?.toFixed(1)} {p.unit}/g</>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>

                        {/* Supplier cell */}
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <SupplierCell
                            product={p}
                            suppliers={suppliers}
                            onChange={handleAssignSupplier}
                          />
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          {p.is_below_threshold ? (
                            <span className="badge-critical"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Kritik</span>
                          ) : ratio < 0.6 ? (
                            <span className="badge-warning"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Dikkat</span>
                          ) : (
                            <span className="badge-ok"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Normal</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => open("add-stock", p)} title="Stok ekle"
                              className="p-1.5 rounded-lg border border-brand-200 text-brand-600 hover:bg-brand-50 transition-colors">
                              <Plus size={14} />
                            </button>
                            <button onClick={() => open("remove-stock", p)} title="Stok azalt"
                              className="p-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors">
                              <Minus size={14} />
                            </button>
                            <button onClick={() => open("delete", p)} title="Ürünü sil"
                              className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {activeModal === "new-product" && (
        <NewProductModal suppliers={suppliers} onCancel={closeModal} onConfirm={handleNewProduct} />
      )}
      {activeModal === "add-stock" && target && <AddStockModal product={target} onCancel={closeModal} onConfirm={handleAddStock} />}
      {activeModal === "remove-stock" && target && <RemoveStockModal product={target} onCancel={closeModal} onConfirm={handleRemoveStock} />}
      {activeModal === "delete" && target && <DeleteModal product={target} onCancel={closeModal} onConfirm={handleDelete} />}
    </div>
  );
}
