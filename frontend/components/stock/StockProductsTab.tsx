"use client";

import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";
import {
  Plus, Minus, Trash2, Loader2, PackageSearch, PackagePlus,
  Users, ChevronDown, Check, X, Search, Download,
} from "lucide-react";
import type { Product, Supplier } from "./types";

// ── CSV export ─────────────────────────────────────────────────────────────

function exportProductsCSV(products: Product[]) {
  const headers = ["Ürün Adı", "SKU", "Birim", "Mevcut Stok", "Eşik", "Durum", "Tedarikçi"];
  const data = products.map(p => {
    const ratio = p.threshold > 0 ? p.current_stock / p.threshold : 1;
    const status = p.is_below_threshold ? "Kritik" : ratio < 1.2 ? "Dikkat" : "Normal";
    return [
      p.name,
      p.sku,
      p.unit,
      p.current_stock.toString().replace(".", ","),
      p.threshold.toString().replace(".", ","),
      status,
      p.supplier?.name ?? "",
    ];
  });

  const bom = "﻿";
  const csv = bom + [headers, ...data]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `stok-envanteri-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Stock bar ──────────────────────────────────────────────────────────────

function StockBar({ current, threshold }: { current: number; threshold: number }) {
  const max = Math.max(current, threshold) * 1.4 || 1;
  const pct = Math.min((current / max) * 100, 100);
  const thPct = Math.min((threshold / max) * 100, 100);
  const ratio = threshold > 0 ? current / threshold : 1;
  const isCritical = threshold > 0 && current < threshold;
  const isWarning  = !isCritical && ratio < 1.2;
  const color = isCritical ? "bg-red-500" : isWarning ? "bg-amber-400" : "bg-gsuccess-500";
  return (
    <div className="relative h-2 bg-slate-100 rounded-full w-24 overflow-visible">
      <div className={clsx("absolute left-0 top-0 h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-slate-400/50 rounded-sm" style={{ left: `${thPct}%` }} />
    </div>
  );
}

// ── Custom filter pill group ───────────────────────────────────────────────

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; dot?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map(({ key, label, dot }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
            value === key
              ? "bg-slate-800 text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50"
          )}
        >
          {dot && <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", dot)} />}
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Supplier cell with custom dropdown ────────────────────────────────────

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = product.supplier;

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className={clsx(
          "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all max-w-[150px]",
          current
            ? "bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100"
            : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:border-slate-300"
        )}
        title={current ? `${current.name} — ${current.email}` : "Tedarikçi ata"}
      >
        <Users size={11} className="flex-shrink-0" />
        <span className="truncate font-medium">{current ? current.name : "Tedarikçi Ata"}</span>
        <ChevronDown size={10} className={clsx("flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 overflow-hidden">
          {current && (
            <button
              onClick={() => { onChange(product.id, null); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
            >
              <X size={12} className="flex-shrink-0" />
              <span className="font-medium">Tedarikçiyi Kaldır</span>
            </button>
          )}
          {current && suppliers.length > 0 && (
            <div className="mx-3 my-1 border-t border-slate-100" />
          )}

          {suppliers.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-400 text-center">
              Henüz tedarikçi eklenmemiş
            </p>
          ) : (
            suppliers.map(s => {
              const selected = product.supplier_id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => { onChange(product.id, s.id); setOpen(false); }}
                  className={clsx(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                    selected ? "bg-brand-50" : "hover:bg-slate-50"
                  )}
                >
                  <div className={clsx(
                    "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                    selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"
                  )}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx("text-xs font-semibold truncate", selected ? "text-brand-700" : "text-slate-700")}>
                      {s.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{s.email}</p>
                  </div>
                  {selected && <Check size={12} className="flex-shrink-0 text-brand-600" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

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

// ── Filter config ──────────────────────────────────────────────────────────

const STATUS_OPTS = [
  { key: "all"      as const, label: "Tümü"   },
  { key: "critical" as const, label: "Kritik",  dot: "bg-red-500"     },
  { key: "warning"  as const, label: "Dikkat",  dot: "bg-amber-400"   },
  { key: "normal"   as const, label: "Normal",  dot: "bg-brand-500"   },
];

const SUPPLIER_OPTS = [
  { key: "all"        as const, label: "Tüm Tedarikçiler" },
  { key: "assigned"   as const, label: "Atanmış"          },
  { key: "unassigned" as const, label: "Atanmamış"        },
];

// ── Main component ─────────────────────────────────────────────────────────

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
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState<"all" | "critical" | "warning" | "normal">("all");
  const [supplierFilter, setSupplierFilter] = useState<"all" | "assigned" | "unassigned">("all");

  const filteredProducts = products.filter((p) => {
    const ratio = p.threshold > 0 ? p.current_stock / p.threshold : 1;
    const q = search.trim().toLowerCase();
    const matchesSearch   = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    const matchesStatus   =
      statusFilter === "all" ||
      (statusFilter === "critical"  && p.is_below_threshold) ||
      (statusFilter === "warning"   && !p.is_below_threshold && ratio < 1.2) ||
      (statusFilter === "normal"    && !p.is_below_threshold && ratio >= 1.2);
    const matchesSupplier =
      supplierFilter === "all" ||
      (supplierFilter === "assigned"   && !!p.supplier_id) ||
      (supplierFilter === "unassigned" && !p.supplier_id);
    return matchesSearch && matchesStatus && matchesSupplier;
  });

  return (
    <>
      {/* ── Stats cards ───────────────────────────────────────────────── */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {(() => {
            const warning = products.filter(p => !p.is_below_threshold && p.threshold > 0 && p.current_stock / p.threshold < 1.2).length;
            const normal  = products.length - critical - warning;
            const cards = [
              { label: "Toplam Ürün",       value: products.length,                        color: "text-slate-800"  },
              { label: "Kritik Stok",       value: critical,                               color: critical > 0 ? "text-red-600" : "text-slate-800" },
              { label: "Dikkat / Normal",   value: `${warning} / ${normal}`,              color: warning > 0 ? "text-amber-600" : "text-brand-600" },
              { label: "Tedarikçi Atanmış", value: `${assignedCount}/${products.length}`,  color: assignedCount === products.length ? "text-brand-600" : "text-amber-600" },
            ];
            return cards.map(({ label, value, color }) => (
              <div key={label} className="card p-4 text-center">
                <p className={clsx("text-2xl font-bold", color)}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ));
          })()}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400">
          <Loader2 className="animate-spin mr-2" size={20} />
          <span className="text-sm">Yükleniyor...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-slate-400">
          <PackageSearch size={40} strokeWidth={1.5} className="mb-3 text-slate-300" />
          <p className="text-base font-medium text-slate-500 mb-1">Ürün bulunamadı</p>
          <p className="text-sm text-slate-400 mb-5">Aşağıdan ilk ürününüzü ekleyerek başlayın</p>
          <button onClick={onOpenNewProduct} className="btn-primary">
            <PackagePlus size={15} /> İlk Ürünü Ekle
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Card header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="section-title">Ürün Kataloğu</h2>
              {critical > 0 && (
                <span className="badge-critical">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {critical} kritik ürün
                </span>
              )}
            </div>
            <button
              onClick={() => exportProductsCSV(filteredProducts)}
              disabled={filteredProducts.length === 0}
              className="btn-secondary text-xs gap-1.5 disabled:opacity-40"
            >
              <Download size={13} />
              CSV İndir
            </button>
          </div>

          {/* Filters */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/40 space-y-3">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ürün adı veya SKU ara..."
                className="pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 w-full transition-all"
              />
            </div>

            {/* Pill filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Durum:</span>
                <PillGroup options={STATUS_OPTS} value={statusFilter} onChange={setStatusFilter} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Tedarikçi:</span>
                <PillGroup options={SUPPLIER_OPTS} value={supplierFilter} onChange={setSupplierFilter} />
              </div>
            </div>

            <p className="text-xs text-slate-400">
              <span className="font-medium text-slate-600">{filteredProducts.length}</span> / {products.length} ürün görüntüleniyor
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {[
                    { label: "Ürün / SKU",   align: "left",  hide: ""            },
                    { label: "Stok Seviyesi",align: "left",  hide: "hidden lg:table-cell" },
                    { label: "Mevcut",       align: "right", hide: ""            },
                    { label: "Eşik",         align: "right", hide: ""            },
                    { label: "Günlük",       align: "right", hide: "hidden md:table-cell" },
                    { label: "Tedarikçi",    align: "left",  hide: "hidden sm:table-cell" },
                    { label: "Durum",        align: "right", hide: ""            },
                    { label: "İşlemler",     align: "right", hide: ""            },
                  ].map(h => (
                    <th key={h.label} className={clsx(
                      "px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider",
                      h.align === "right" ? "text-right" : "text-left",
                      h.hide
                    )}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredProducts.map(p => {
                  const ratio = p.threshold > 0 ? p.current_stock / p.threshold : 1;
                  const isWarning = !p.is_below_threshold && ratio < 1.2;
                  return (
                    <tr key={p.id} className={clsx(
                      "transition-colors hover:bg-slate-50/80",
                      p.is_below_threshold ? "bg-red-50/30" : isWarning && "bg-amber-50/30"
                    )}>
                      {/* Name */}
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{p.sku}</p>
                      </td>
                      {/* Bar */}
                      <td className="px-4 py-3.5 hidden lg:table-cell w-36">
                        <StockBar current={p.current_stock} threshold={p.threshold} />
                        <p className="text-[10px] text-slate-400 mt-1">{Math.round(ratio * 100)}% dolu</p>
                      </td>
                      {/* Current */}
                      <td className="px-4 py-3.5 text-right">
                        <span className={clsx("font-bold text-base tabular-nums", p.is_below_threshold ? "text-red-600" : isWarning ? "text-amber-600" : "text-slate-800")}>
                          {p.current_stock.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">{p.unit}</span>
                      </td>
                      {/* Threshold */}
                      <td className="px-4 py-3.5 text-right text-slate-500 text-sm tabular-nums">
                        {p.threshold.toLocaleString("tr-TR")}
                        <span className="text-slate-400 text-xs ml-1">{p.unit}</span>
                      </td>
                      {/* Daily */}
                      <td className="px-4 py-3.5 text-right hidden md:table-cell text-slate-500 text-xs tabular-nums">
                        {(p.daily_consumption ?? 0) > 0 ? <>{p.daily_consumption?.toFixed(1)} {p.unit}/gün</> : <span className="text-slate-300">—</span>}
                      </td>
                      {/* Supplier */}
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <SupplierCell product={p} suppliers={suppliers} onChange={onAssignSupplier} />
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3.5 text-right">
                        {p.is_below_threshold ? (
                          <span className="badge-critical"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Kritik</span>
                        ) : isWarning ? (
                          <span className="badge-warning"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />Dikkat</span>
                        ) : (
                          <span className="badge-ok"><span className="w-1.5 h-1.5 rounded-full bg-gsuccess-500" />Normal</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => onOpenAddStock(p)} title="Stok ekle"
                            className="p-1.5 rounded-lg border border-brand-200 text-brand-600 hover:bg-brand-50 transition-colors">
                            <Plus size={14} />
                          </button>
                          <button onClick={() => onOpenRemoveStock(p)} title="Stok azalt"
                            className="p-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors">
                            <Minus size={14} />
                          </button>
                          <button onClick={() => onOpenDelete(p)} title="Ürünü sil"
                            className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Search size={20} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-sm text-slate-400">Filtrelere uygun ürün bulunamadı</p>
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
