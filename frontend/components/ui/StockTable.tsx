import { clsx } from "clsx";
import { PackageSearch, TrendingDown, Clock } from "lucide-react";

interface StockLevel {
  id: number;
  name: string;
  sku: string;
  unit: string;
  threshold: number;
  current_stock: number;
  is_below_threshold: boolean;
  daily_consumption?: number;
  days_to_empty?: number | null;
}

interface Props {
  stocks: StockLevel[];
  loading: boolean;
}

function StockBar({ current, threshold }: { current: number; threshold: number }) {
  const max = Math.max(current, threshold) * 1.35 || 1;
  const pct = Math.min((current / max) * 100, 100);
  const thPct = Math.min((threshold / max) * 100, 100);
  const ratio = threshold > 0 ? current / threshold : 1;

  const barColor =
    ratio < 0.3 ? "bg-red-500" :
    ratio < 0.6 ? "bg-amber-400" :
    "bg-brand-500";

  return (
    <div className="relative h-2 bg-slate-100 rounded-full overflow-visible w-full min-w-[80px]">
      <div
        className={clsx("absolute left-0 top-0 h-full rounded-full transition-all duration-500", barColor)}
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-slate-400/60 rounded-sm"
        style={{ left: `${thPct}%` }}
        title={`Eşik: ${threshold}`}
      />
    </div>
  );
}

function DaysLabel({ days }: { days: number | null | undefined }) {
  if (days == null) {
    return <span className="text-slate-300 text-xs">—</span>;
  }
  const d = Math.round(days);
  const color = d <= 3 ? "text-red-600" : d <= 7 ? "text-amber-600" : "text-slate-500";
  return (
    <span className={clsx("text-xs font-medium tabular-nums", color)}>
      {d} gün
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${[60, 45, 80, 50, 40, 35][i - 1]}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function StockTable({ stocks, loading }: Props) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="section-title">Stok Seviyeleri</h2>
          {!loading && (
            <p className="text-xs text-slate-400 mt-0.5">
              {stocks.length} ürün &nbsp;·&nbsp;
              <span className="text-red-500 font-medium">
                {stocks.filter(s => s.is_below_threshold).length} kritik
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-500" /> Normal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Dikkat
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Kritik
          </span>
        </div>
      </div>

      {loading ? (
        <table className="w-full">
          <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
        </table>
      ) : stocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <PackageSearch size={36} strokeWidth={1.5} className="mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Ürün bulunamadı</p>
          <p className="text-xs mt-1">Stok Yönetimi sayfasından ürün ekleyin veya seed.py çalıştırın.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ürün</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Seviye</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mevcut</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  <span className="flex items-center justify-end gap-1"><TrendingDown size={11} />Günlük Tüketim</span>
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  <span className="flex items-center justify-end gap-1"><Clock size={11} />Tahmini Süre</span>
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stocks.map((s) => {
                const ratio = s.threshold > 0 ? s.current_stock / s.threshold : 1;
                return (
                  <tr
                    key={s.id}
                    className={clsx(
                      "transition-colors hover:bg-slate-50",
                      s.is_below_threshold && "bg-red-50/40"
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <div>
                        <span className="font-semibold text-slate-800">{s.name}</span>
                        <span className="block text-xs text-slate-400 font-mono mt-0.5">{s.sku}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 hidden lg:table-cell w-44">
                      <div className="space-y-1">
                        <StockBar current={s.current_stock} threshold={s.threshold} />
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>0</span>
                          <span className="text-slate-500">eşik: {s.threshold}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <span className={clsx(
                        "font-bold text-base tabular-nums",
                        ratio < 0.3 ? "text-red-600" : ratio < 0.6 ? "text-amber-600" : "text-slate-800"
                      )}>
                        {s.current_stock.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">{s.unit}</span>
                    </td>

                    <td className="px-5 py-3.5 text-right hidden md:table-cell text-slate-500 text-xs tabular-nums">
                      {(s.daily_consumption ?? 0) > 0
                        ? <>{s.daily_consumption?.toFixed(1)} <span className="text-slate-400">{s.unit}/gün</span></>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>

                    <td className="px-5 py-3.5 text-right hidden md:table-cell">
                      <DaysLabel days={s.days_to_empty} />
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {s.is_below_threshold ? (
                        <span className="badge-critical">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Kritik
                        </span>
                      ) : ratio < 0.6 ? (
                        <span className="badge-warning">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Dikkat
                        </span>
                      ) : (
                        <span className="badge-ok">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Normal
                        </span>
                      )}
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
