import { clsx } from "clsx";
import { PackageSearch } from "lucide-react";

interface StockLevel {
  id: number;
  name: string;
  sku: string;
  unit: string;
  threshold: number;
  current_stock: number;
  is_below_threshold: boolean;
}

interface Props {
  stocks: StockLevel[];
  loading: boolean;
}

function StockBar({ current, threshold }: { current: number; threshold: number }) {
  const max = Math.max(current, threshold) * 1.3 || 1;
  const pct = Math.min((current / max) * 100, 100);
  const thresholdPct = Math.min((threshold / max) * 100, 100);
  const isCritical = current < threshold;

  return (
    <div className="relative h-1.5 bg-slate-800 rounded-full overflow-visible w-full">
      <div
        className={clsx(
          "absolute left-0 top-0 h-full rounded-full transition-all duration-500",
          isCritical ? "bg-red-500" : "bg-brand-500"
        )}
        style={{ width: `${pct}%` }}
      />
      {/* Threshold marker */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-yellow-400/70 rounded-sm"
        style={{ left: `${thresholdPct}%` }}
        title={`Threshold: ${threshold}`}
      />
    </div>
  );
}

export default function StockTable({ stocks, loading }: Props) {
  return (
    <div className="card-glow rounded-xl bg-[#111a14] border border-[rgba(34,197,94,0.08)] overflow-hidden">
      <div className="px-6 py-4 border-b border-[rgba(34,197,94,0.08)] flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">Current Stock Levels</h2>
        <span className="text-xs text-slate-500">{stocks.length} products</span>
      </div>

      {loading ? (
        <div className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-4">
              <div className="h-4 w-32 bg-[#1e2d22] rounded" />
              <div className="h-2 flex-1 bg-[#1e2d22] rounded" />
              <div className="h-4 w-16 bg-[#1e2d22] rounded" />
            </div>
          ))}
        </div>
      ) : stocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <PackageSearch size={36} strokeWidth={1} className="mb-3" />
          <p className="text-sm">No products yet. Run the seed script to add demo data.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3">Product</th>
                <th className="text-left px-6 py-3 hidden md:table-cell">SKU</th>
                <th className="text-left px-6 py-3 hidden lg:table-cell">Stock Level</th>
                <th className="text-right px-6 py-3">Quantity</th>
                <th className="text-right px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(34,197,94,0.05)]">
              {stocks.map((s) => (
                <tr
                  key={s.id}
                  className={clsx(
                    "transition-colors hover:bg-[rgba(34,197,94,0.03)]",
                    s.is_below_threshold && "bg-[rgba(239,68,68,0.03)]"
                  )}
                >
                  <td className="px-6 py-4">
                    <span className="font-medium text-white">{s.name}</span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell text-slate-500 font-mono text-xs">
                    {s.sku}
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell w-40">
                    <StockBar current={s.current_stock} threshold={s.threshold} />
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    <span className={s.is_below_threshold ? "text-red-400" : "text-brand-400"}>
                      {s.current_stock.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-slate-500 text-xs ml-1">{s.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {s.is_below_threshold ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        Critical
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
