"use client";

import { useState } from "react";
import { clsx } from "clsx";
import {
  ArrowDownLeft, ArrowUpRight, Minus,
  Search, Download, History, Loader2,
  Smartphone, Globe, Hand, Camera, MessageSquare,
} from "lucide-react";
import type { StockMovementRow } from "./types";

// ── Source display config ──────────────────────────────────────────────────

const SOURCE_CONFIG: Record<string, { label: string; Icon: typeof Smartphone; color: string }> = {
  telegram_text:   { label: "Telegram",          Icon: Smartphone,    color: "bg-blue-50 text-blue-700 border-blue-200"    },
  telegram_photo:  { label: "Telegram (Fotoğraf)",Icon: Camera,       color: "bg-blue-50 text-blue-700 border-blue-200"    },
  webhook_text:    { label: "Web (Metin)",        Icon: Globe,        color: "bg-purple-50 text-purple-700 border-purple-200" },
  webhook_image:   { label: "Web (Görsel)",       Icon: Globe,        color: "bg-purple-50 text-purple-700 border-purple-200" },
  manual:          { label: "Manuel",             Icon: Hand,         color: "bg-slate-100 text-slate-600 border-slate-200"  },
  whatsapp_text:   { label: "WhatsApp",           Icon: MessageSquare,color: "bg-green-50 text-green-700 border-green-200"  },
  invoice_photo:   { label: "Fatura (Fotoğraf)", Icon: Camera,       color: "bg-amber-50 text-amber-700 border-amber-200"  },
};

const DEFAULT_SOURCE = { label: "Sistem", Icon: Globe, color: "bg-slate-100 text-slate-500 border-slate-200" };

function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_CONFIG[source] ?? { ...DEFAULT_SOURCE, label: source };
  const { label, Icon, color } = cfg;
  return (
    <span className={clsx("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border", color)}>
      <Icon size={9} />
      {label}
    </span>
  );
}

// ── Type badge ─────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  if (type === "in")
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gsuccess-50 text-gsuccess-700 border border-gsuccess-200"><ArrowDownLeft size={9} />Giriş</span>;
  if (type === "out")
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200"><ArrowUpRight size={9} />Çıkış</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200"><Minus size={9} />Sayım</span>;
}

// ── CSV export ─────────────────────────────────────────────────────────────

function exportHistoryCSV(rows: StockMovementRow[]) {
  const headers = ["ID", "Tarih", "Saat", "Ürün", "SKU", "Miktar", "Birim", "İşlem Tipi", "Kaynak", "Notlar"];
  const data = rows.map(r => {
    const d = new Date(r.timestamp);
    return [
      r.id,
      d.toLocaleDateString("tr-TR"),
      d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      r.product_name,
      r.product_sku,
      r.quantity.toString().replace(".", ","),
      r.unit,
      r.type === "in" ? "Giriş" : r.type === "out" ? "Çıkış" : "Sayım",
      SOURCE_CONFIG[r.source]?.label ?? r.source,
      r.notes ?? "",
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
  a.download = `hareket-gecmisi-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[40, 28, 55, 35, 20, 45, 38].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3.5 bg-slate-100 rounded animate-pulse" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  movements: StockMovementRow[];
  loading: boolean;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function StockHistoryTab({ movements, loading }: Props) {
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "in" | "out">("all");

  const filtered = movements.filter(r => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      r.product_name.toLowerCase().includes(q) ||
      r.product_sku.toLowerCase().includes(q) ||
      (r.notes ?? "").toLowerCase().includes(q);
    const matchesType =
      typeFilter === "all" ||
      r.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalIn  = filtered.filter(r => r.type === "in").reduce((s, r) => s + r.quantity, 0);
  const totalOut = filtered.filter(r => r.type === "out").reduce((s, r) => s + Math.abs(r.quantity), 0);

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <History size={16} className="text-brand-600" />
          <div>
            <h2 className="section-title">Hareket Geçmişi</h2>
            {!loading && (
              <p className="text-xs text-slate-400 mt-0.5">
                Append-only ledger &nbsp;·&nbsp;
                <span className="text-gsuccess-600 font-medium">{movements.length} kayıt</span>
                &nbsp;·&nbsp; Son 300 hareket
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => exportHistoryCSV(filtered)}
          disabled={loading || filtered.length === 0}
          className="btn-secondary text-xs gap-1.5 disabled:opacity-40"
        >
          <Download size={13} />
          CSV İndir
        </button>
      </div>

      {/* Summary chips */}
      {!loading && movements.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-gsuccess-700 bg-gsuccess-50 border border-gsuccess-200 px-3 py-1 rounded-full">
            <ArrowDownLeft size={11} />
            Toplam Giriş: <strong>{totalIn.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
            <ArrowUpRight size={11} />
            Toplam Çıkış: <strong>{totalOut.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</strong>
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ürün adı, SKU veya not ara..."
            className="pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 w-full transition-all"
          />
        </div>

        <div className="flex items-center gap-1">
          {(["all", "in", "out"] as const).map(f => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                typeFilter === f
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              {f === "all" ? "Tümü" : f === "in" ? "Girişler" : "Çıkışlar"}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 ml-auto">
          <span className="font-medium text-slate-600">{filtered.length}</span> / {movements.length} kayıt
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <table className="w-full">
          <tbody>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
        </table>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <History size={36} strokeWidth={1.5} className="mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">
            {movements.length === 0 ? "Henüz hareket kaydı yok" : "Filtreye uyan kayıt bulunamadı"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tarih / Saat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Ürün</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Miktar</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">İşlem</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Kaynak</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Notlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map(r => {
                const d = new Date(r.timestamp);
                const isIn = r.quantity > 0;
                return (
                  <tr key={r.id} className={clsx(
                    "transition-colors hover:bg-slate-50/80",
                    isIn ? "hover:bg-gsuccess-50/20" : "hover:bg-red-50/20"
                  )}>
                    {/* Date */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-sm font-medium text-slate-700 tabular-nums">
                        {d.toLocaleDateString("tr-TR")}
                      </p>
                      <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                        {d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>

                    {/* Product */}
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-800">{r.product_name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{r.product_sku}</p>
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className={clsx(
                        "font-bold text-base tabular-nums",
                        isIn ? "text-gsuccess-600" : "text-red-600"
                      )}>
                        {isIn ? "+" : ""}{r.quantity.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">{r.unit}</span>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3.5 text-center hidden sm:table-cell">
                      <TypeBadge type={r.type} />
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3.5 text-center hidden md:table-cell">
                      <SourceBadge source={r.source} />
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {r.notes
                        ? <span className="text-xs text-slate-500 line-clamp-1">{r.notes}</span>
                        : <span className="text-slate-300 text-xs">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
