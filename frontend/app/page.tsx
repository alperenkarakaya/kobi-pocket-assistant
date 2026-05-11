"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import KpiCard from "@/components/ui/KpiCard";
import StockTable from "@/components/ui/StockTable";
import ApprovalPanel, { type EmailOverrides } from "@/components/ui/ApprovalPanel";
import {
  Boxes, AlertTriangle, Clock, Activity,
  Wifi, WifiOff, Sparkles, Loader2, RefreshCw,
  TrendingDown, PackageCheck, BarChart3,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Kpi {
  label: string;
  value: number | string;
  unit?: string;
  alert?: boolean;
}

interface StockLevel {
  id: number;
  name: string;
  sku: string;
  unit: string;
  threshold: number;
  current_stock: number;
  is_below_threshold: boolean;
  daily_consumption: number;
  days_to_empty: number | null;
}

export interface PendingApproval {
  id: number;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface TrendItem {
  product_id: number;
  product_name: string;
  unit: string;
  current_stock: number;
  threshold: number;
  stock_ratio: number;
  is_critical: boolean;
  daily_avg_consumption: number;
  days_to_empty: number | null;
  total_in_7d: number;
  total_out_7d: number;
  movement_count_7d: number;
}

interface DashboardData {
  kpis: Kpi[];
  stock_levels: StockLevel[];
  pending_approvals: PendingApproval[];
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const KPI_ICONS = [Boxes, AlertTriangle, Clock, Activity];

// ── Analytics mini card ────────────────────────────────────────────────────

function TrendCard({ item }: { item: TrendItem }) {
  const ratio = item.stock_ratio;
  const urgent = ratio < 0.3;
  const warning = ratio >= 0.3 && ratio < 0.6;

  return (
    <div className={`rounded-lg border p-3 flex items-center gap-3 ${
      urgent ? "bg-red-50 border-red-200" :
      warning ? "bg-amber-50 border-amber-200" :
      "bg-white border-slate-200"
    }`}>
      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
        urgent ? "bg-red-500" : warning ? "bg-amber-400" : "bg-brand-500"
      }`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{item.product_name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {item.daily_avg_consumption > 0
            ? `${item.daily_avg_consumption.toFixed(1)} ${item.unit}/gün`
            : "Tüketim verisi yok"
          }
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        {item.days_to_empty != null ? (
          <p className={`text-sm font-bold ${
            item.days_to_empty <= 3 ? "text-red-600" :
            item.days_to_empty <= 7 ? "text-amber-600" : "text-slate-700"
          }`}>
            {Math.round(item.days_to_empty)} gün
          </p>
        ) : (
          <p className="text-sm font-medium text-slate-400">—</p>
        )}
        <p className="text-[10px] text-slate-400">tahmini süre</p>
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5 animate-pulse">
      <div className="h-9 w-9 bg-slate-100 rounded-lg mb-4" />
      <div className="h-8 w-16 bg-slate-100 rounded mb-2" />
      <div className="h-4 w-28 bg-slate-100 rounded" />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, trendRes] = await Promise.all([
        fetch(`${API}/api/dashboard`),
        fetch(`${API}/api/analytics/trends`),
      ]);
      if (!dashRes.ok) throw new Error("API error");
      const json: DashboardData = await dashRes.json();
      setData(json);
      if (trendRes.ok) setTrends(await trendRes.json());
      setLastUpdated(new Date());
      setApiError(false);
    } catch {
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30_000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    const toastId = toast.loading("AI Crew analiz yapıyor (~30 saniye)...");
    try {
      const res = await fetch(`${API}/api/analyze-stocks`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Analiz başarısız");
      }
      const approvals: PendingApproval[] = await res.json();
      await fetchDashboard();
      const count = approvals.length;
      toast.success(
        count > 0
          ? `AI Crew tamamlandı — ${count} kritik ürün için tedarik talebi oluşturuldu.`
          : "AI Crew tamamlandı — tüm stoklar yeterli seviyede.",
        { id: toastId }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`Analiz hatası: ${msg}`, { id: toastId });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApprove = async (id: number, approval: PendingApproval, overrides: EmailOverrides) => {
    const product = (approval.payload.product_name as string) ?? "Ürün";
    const toastId = toast.loading(`${product} için e-posta gönderiliyor...`);
    try {
      const res = await fetch(`${API}/api/actions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_subject: overrides.subject,
          email_body: overrides.body,
          recipient: overrides.recipient,
        }),
      });
      if (!res.ok) throw new Error("İşlem başarısız");
      await fetchDashboard();
      toast.success(`E-posta gönderildi — ${product} tedarik talebi onaylandı.`, {
        id: toastId, duration: 6000,
      });
    } catch {
      toast.error("E-posta gönderilemedi. Tekrar deneyin.", { id: toastId });
    }
  };

  const handleReject = async (id: number, approval: PendingApproval) => {
    const product = (approval.payload.product_name as string) ?? "Ürün";
    try {
      await fetch(`${API}/api/actions/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await fetchDashboard();
      toast(`${product} tedarik talebi reddedildi.`);
    } catch {
      toast.error("İşlem başarısız. Tekrar deneyin.");
    }
  };

  const fallbackKpis: Kpi[] = [
    { label: "Toplam Ürün", value: "--" },
    { label: "Kritik Stok", value: "--" },
    { label: "Onay Bekleyen", value: "--" },
    { label: "Bugünkü Hareket", value: "--" },
  ];
  const kpis = data?.kpis ?? fallbackKpis;
  const criticalTrends = trends.filter(t => t.is_critical || t.stock_ratio < 0.6);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-1">
              Tire Tarım Kooperatifi
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Operasyon Özet Panosu
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              AI destekli stok ve tedarik yönetimi
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Refresh indicator */}
            {lastUpdated && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
                <RefreshCw size={11} />
                {lastUpdated.toLocaleTimeString("tr-TR")}
              </span>
            )}

            {/* API status */}
            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
              apiError
                ? "text-red-600 border-red-200 bg-red-50"
                : "text-brand-700 border-brand-200 bg-brand-50"
            }`}>
              {apiError ? <WifiOff size={12} /> : <Wifi size={12} />}
              {apiError ? "API Bağlantı Hatası" : "Canlı"}
            </div>

            {/* AI Analysis button */}
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="btn-primary shadow-sm"
            >
              {analyzing
                ? <><Loader2 size={15} className="animate-spin" />Crew çalışıyor...</>
                : <><Sparkles size={15} />AI Crew Analizi Başlat</>
              }
            </button>
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
            : kpis.map((kpi, i) => (
                <KpiCard
                  key={kpi.label}
                  label={kpi.label}
                  value={kpi.value}
                  unit={kpi.unit}
                  alert={kpi.alert}
                  Icon={KPI_ICONS[i]}
                />
              ))}
        </div>

        {/* ── Main Content Grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Stock table (2/3) */}
          <div className="xl:col-span-2 space-y-6">
            <StockTable stocks={data?.stock_levels ?? []} loading={loading} />

            {/* Analytics Trends */}
            {!loading && criticalTrends.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-brand-600" />
                    <h2 className="section-title">7 Günlük Tüketim Tahmini</h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Kritik ve uyarı seviyesindeki ürünler
                  </p>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {criticalTrends.map(t => <TrendCard key={t.product_id} item={t} />)}
                </div>
              </div>
            )}

            {/* Summary stats */}
            {!loading && trends.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    icon: PackageCheck,
                    label: "7 Günde Giren",
                    value: `${trends.reduce((s, t) => s + t.total_in_7d, 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} birim`,
                    color: "text-brand-600 bg-brand-50",
                  },
                  {
                    icon: TrendingDown,
                    label: "7 Günde Çıkan",
                    value: `${trends.reduce((s, t) => s + t.total_out_7d, 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} birim`,
                    color: "text-amber-600 bg-amber-50",
                  },
                  {
                    icon: Activity,
                    label: "Toplam Hareket",
                    value: `${trends.reduce((s, t) => s + t.movement_count_7d, 0)} işlem`,
                    color: "text-blue-600 bg-blue-50",
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="card p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${color}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">{label}</p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approval panel (1/3) */}
          <div className="xl:col-span-1">
            <ApprovalPanel
              approvals={data?.pending_approvals ?? []}
              loading={loading}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="mt-12 pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
          <span>Tire Tarım Kooperatifi · KOBI Tarım Asistanı v3.0</span>
          <span>Gemini 2.5 Flash · CrewAI · FastAPI · Next.js</span>
        </footer>
      </div>
    </div>
  );
}
