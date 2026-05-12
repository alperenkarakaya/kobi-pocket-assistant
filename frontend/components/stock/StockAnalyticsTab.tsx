import { clsx } from "clsx";
import { Loader2, BarChart3, CalendarClock, TrendingUp, TrendingDown, AlertOctagon } from "lucide-react";
import { DaysToEmptyChart, WeeklyFlowChart } from "@/components/ui/StockCharts";
import type { AnalyticsHistory, TrendItem } from "./types";

interface StockAnalyticsTabProps {
  loading: boolean;
  trends: TrendItem[];
  history: AnalyticsHistory;
}

export default function StockAnalyticsTab({ loading, trends, history }: StockAnalyticsTabProps) {
  const topRisk = trends
    .filter(t => t.days_to_empty !== null || t.is_critical)
    .sort((a, b) => {
      if (a.is_critical !== b.is_critical) return a.is_critical ? -1 : 1;
      return (a.days_to_empty ?? 9999) - (b.days_to_empty ?? 9999);
    })
    .slice(0, 5);

  const fastMoving = trends
    .filter(t => t.daily_avg_consumption > 0)
    .sort((a, b) => b.daily_avg_consumption - a.daily_avg_consumption)
    .slice(0, 5);

  const productsWithIn7d = trends.filter(t => t.total_in_7d > 0).length;
  const productsWithOut7d = trends.filter(t => t.total_out_7d > 0).length;
  const totalMoves7d = trends.reduce((sum, t) => sum + t.movement_count_7d, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        <span className="text-sm">Analiz verileri yukleniyor...</span>
      </div>
    );
  }

  if (trends.length === 0) {
    return (
      <div className="card py-12 text-center text-slate-500 text-sm">
        Analiz için yeterli stok hareketi bulunamadı.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "7 Günde Giriş Olan Ürün", value: productsWithIn7d, icon: TrendingUp, color: "text-gsuccess-600 bg-gsuccess-50" },
          { label: "7 Günde Çıkış Olan Ürün", value: productsWithOut7d, icon: TrendingDown, color: "text-amber-600 bg-amber-50" },
          { label: "Kritik Risk", value: topRisk.filter(x => x.is_critical).length, icon: AlertOctagon, color: "text-red-600 bg-red-50" },
          { label: "Toplam Hareket", value: totalMoves7d, icon: BarChart3, color: "text-brand-600 bg-brand-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={clsx("p-2 rounded-lg", color)}>
              <Icon size={16} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className="text-lg font-bold text-slate-800 mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CalendarClock size={15} className="text-brand-600" />
              <h2 className="section-title">Tahmini Stok Ömrü</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Mevcut tuketim hizina gore tahmin</p>
          </div>
          <div className="px-4 pt-3 pb-4">
            <DaysToEmptyChart trends={trends} />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BarChart3 size={15} className="text-brand-600" />
              <h2 className="section-title">Günlük Giriş / Çıkış</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Son 7 gunde toplam hareket analizi</p>
          </div>
          <div className="px-4 pt-3 pb-4">
            <WeeklyFlowChart history={history} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">En Riskli Ürünler</h3>
          <div className="space-y-2">
            {topRisk.map(item => (
              <div key={item.product_id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-700">{item.product_name}</p>
                  <p className="text-xs text-slate-400">Tüketim: {item.daily_avg_consumption.toFixed(1)} {item.unit}/gün</p>
                </div>
                <span className={clsx(
                  "text-xs font-semibold px-2 py-1 rounded-full",
                  item.is_critical || (item.days_to_empty ?? 999) <= 7 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                )}>
                  {item.days_to_empty == null ? "Belirsiz" : `${Math.round(item.days_to_empty)} gün`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Tüketim Hızı Liderleri</h3>
          <div className="space-y-2">
            {fastMoving.length === 0 ? (
              <p className="text-sm text-slate-400">Henüz tüketim verisi yok.</p>
            ) : fastMoving.map(item => (
              <div key={item.product_id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-sm font-medium text-slate-700">{item.product_name}</p>
                <p className="text-sm font-semibold text-slate-800">{item.daily_avg_consumption.toFixed(1)} {item.unit}/gün</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
