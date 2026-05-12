import { useState } from "react";
import { clsx } from "clsx";
import { Plus, Minus, Trash2, Loader2, PackageSearch, PackagePlus, Users } from "lucide-react";
import type { Product, Supplier } from "./types";

function StockBar({ current, threshold }: { current: number; threshold: number }) {
  const max = Math.max(current, threshold) * 1.4 || 1;
  const pct = Math.min((current / max) * 100, 100);
  const thPct = Math.min((threshold / max) * 100, 100);
  const ratio = threshold > 0 ? current / threshold : 1;
  const isCritical = threshold > 0 && current < threshold;
  const color = isCritical ? "bg-red-500" : ratio < 0.6 ? "bg-amber-400" : "bg-gsuccess-500";

  return (
    <div className="relative h-2 bg-slate-100 rounded-full w-24 overflow-visible">
      <div className={clsx("absolute left-0 top-0 h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-slate-400/50 rounded-sm" style={{ left: `${thPct}%` }} />
    </div>
  );
}

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

interface StockProductsTabProps {
  products: Product[];
  suppliers: Supplier[];
  loading: boolean;
  critical: number;
  assignedCount: number;
  onOpenNewProduct: () => void;
  onAssignSupplier: (productId: number, supplierId: number | null) => void;
  onOpenAddStock: (product: Product) => void;
  onOpenRemoveStock: (product: Product) => void;
  onOpenDelete: (product: Product) => void;
}

export default function StockProductsTab({
  products,
  suppliers,
  loading,
  critical,
  assignedCount,
  onOpenNewProduct,
  onAssignSupplier,
  onOpenAddStock,
  onOpenRemoveStock,
  onOpenDelete,
}: StockProductsTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "critical" | "warning" | "normal">("all");
  const [supplierFilter, setSupplierFilter] = useState<"all" | "assigned" | "unassigned">("all");

  const filteredProducts = products.filter((p) => {
    const ratio = p.threshold > 0 ? p.current_stock / p.threshold : 1;
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch =
      normalizedSearch.length === 0 ||
      p.name.toLowerCase().includes(normalizedSearch) ||
      p.sku.toLowerCase().includes(normalizedSearch);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "critical" && p.is_below_threshold) ||
      (statusFilter === "warning" && !p.is_below_threshold && ratio < 0.6) ||
      (statusFilter === "normal" && !p.is_below_threshold && ratio >= 0.6);

    const matchesSupplier =
      supplierFilter === "all" ||
      (supplierFilter === "assigned" && !!p.supplier_id) ||
      (supplierFilter === "unassigned" && !p.supplier_id);

    return matchesSearch && matchesStatus && matchesSupplier;
  });

  return (
    <>
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400">
          <Loader2 className="animate-spin mr-2" size={20} />
          <span className="text-sm">Yukleniyor...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-slate-400">
          <PackageSearch size={40} strokeWidth={1.5} className="mb-3 text-slate-300" />
          <p className="text-base font-medium text-slate-500 mb-1">Ürün bulunamadı</p>
          <p className="text-sm text-slate-400 mb-5">Aşağıdan ilk ürününüzü ekleyerek başlayın</p>
          <button onClick={onOpenNewProduct} className="btn-primary">
            <PackagePlus size={15} />Ilk Urunu Ekle
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

          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ürün adı veya SKU ara..."
                className="form-input h-9 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "critical" | "warning" | "normal")}
                className="form-input h-9 text-sm"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="critical">Kritik</option>
                <option value="warning">Dikkat</option>
                <option value="normal">Normal</option>
              </select>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value as "all" | "assigned" | "unassigned")}
                className="form-input h-9 text-sm"
              >
                <option value="all">Tüm Tedarikçi Durumları</option>
                <option value="assigned">Tedarikçi Atanmış</option>
                <option value="unassigned">Tedarikçi Atanmamış</option>
              </select>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {filteredProducts.length} / {products.length} ürün görüntüleniyor
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Ürün / SKU", "Stok Seviyesi", "Mevcut", "Eşik", "Günlük", "Tedarikçi", "Durum", "İşlemler"].map(h => (
                    <th key={h} className={clsx(
                      "px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider",
                      h === "Islemler" ? "text-right" :
                      ["Mevcut", "Eşik", "Günlük", "Durum"].includes(h) ? "text-right" : "text-left",
                      h === "Stok Seviyesi" && "hidden lg:table-cell",
                      h === "Günlük" && "hidden md:table-cell",
                      h === "Tedarikçi" && "hidden sm:table-cell"
                    )}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredProducts.map(p => {
                  const ratio = p.threshold > 0 ? p.current_stock / p.threshold : 1;
                  return (
                    <tr key={p.id} className={clsx("transition-colors hover:bg-slate-50", p.is_below_threshold && "bg-red-50/30")}>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{p.sku}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell w-36">
                        <StockBar current={p.current_stock} threshold={p.threshold} />
                        <p className="text-[10px] text-slate-400 mt-1">{Math.round(Math.min(ratio * 100, 100))}% dolu</p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={clsx("font-bold text-base tabular-nums", p.is_below_threshold ? "text-red-600" : ratio < 0.6 ? "text-amber-600" : "text-slate-800")}>
                          {p.current_stock.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">{p.unit}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-500 text-sm tabular-nums">
                        {p.threshold.toLocaleString("tr-TR")}
                        <span className="text-slate-400 text-xs ml-1">{p.unit}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right hidden md:table-cell text-slate-500 text-xs tabular-nums">
                        {(p.daily_consumption ?? 0) > 0 ? <>{p.daily_consumption?.toFixed(1)} {p.unit}/gün</> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <SupplierCell product={p} suppliers={suppliers} onChange={onAssignSupplier} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {p.is_below_threshold ? (
                          <span className="badge-critical"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Kritik</span>
                        ) : ratio < 0.6 ? (
                          <span className="badge-warning"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Dikkat</span>
                        ) : (
                          <span className="badge-ok"><span className="w-1.5 h-1.5 rounded-full bg-gsuccess-500" />Normal</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => onOpenAddStock(p)} title="Stok ekle" className="p-1.5 rounded-lg border border-brand-200 text-brand-600 hover:bg-brand-50 transition-colors">
                            <Plus size={14} />
                          </button>
                          <button onClick={() => onOpenRemoveStock(p)} title="Stok azalt" className="p-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors">
                            <Minus size={14} />
                          </button>
                          <button onClick={() => onOpenDelete(p)} title="Urunu sil" className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                      Filtrelere uygun ürün bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
