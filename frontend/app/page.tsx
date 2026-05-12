"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import KpiCard from "@/components/ui/KpiCard";
import StockTable from "@/components/ui/StockTable";
import type { DailyProduct } from "@/components/ui/StockCharts";
import {
  Boxes, AlertTriangle, Clock, Activity,
  Wifi, WifiOff, Sparkles, Loader2, RefreshCw,
  TrendingDown, PackageCheck,
  X, ChevronRight,
  Search, FileStack, Mail,
} from "lucide-react";
import { apiFetch, getToken } from "@/lib/auth";
import ApprovalPanel, { type EmailOverrides } from "@/components/ui/ApprovalPanel";
import { useCopilot } from "@/components/CopilotContext";

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

const KPI_ICONS = [Boxes, AlertTriangle, Clock, Activity];

// ── Critical Alert Banner ──────────────────────────────────────────────────

function CriticalAlertBanner({ stocks }: { stocks: StockLevel[] }) {
  const [dismissed, setDismissed] = useState(false);
  const criticals = stocks.filter(s => s.is_below_threshold);

  if (dismissed || criticals.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex-shrink-0 p-1.5 bg-red-100 rounded-lg">
        <AlertTriangle size={16} className="text-red-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-800">
          {criticals.length} ürün kritik stok seviyesinde
        </p>
        <p className="text-xs text-red-600 mt-0.5 truncate">
          {criticals.slice(0, 4).map(s => s.name).join(" · ")}
          {criticals.length > 4 && ` +${criticals.length - 4} daha`}
        </p>
      </div>
      <Link
        href="/stock"
        className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-900 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-100 transition-colors flex-shrink-0"
      >
        Stok Yönetimine Git
        <ChevronRight size={12} />
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
        title="Kapat"
      >
        <X size={14} />
      </button>
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
  const { setPendingCount } = useCopilot();
  const [data, setData] = useState<DashboardData | null>(null);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [history, setHistory] = useState<DailyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [crewStep, setCrewStep]   = useState(0); // 0=idle 1=analyst 2=planner 3=drafter

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, trendRes, histRes] = await Promise.all([
        apiFetch("/api/dashboard"),
        apiFetch("/api/analytics/trends"),
        apiFetch("/api/analytics/daily-history"),
      ]);
      if (!dashRes.ok) throw new Error("API error");
      const json: DashboardData = await dashRes.json();
      setData(json);
      setPendingCount(json.pending_approvals?.length ?? 0);
      if (trendRes.ok) setTrends(await trendRes.json());
      if (histRes.ok) setHistory(await histRes.json());
      setLastUpdated(new Date());
      setApiError(false);
    } catch {
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }, [setPendingCount]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 10_000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setCrewStep(1);
    const t2 = setTimeout(() => setCrewStep(2), 10_000);
    const t3 = setTimeout(() => setCrewStep(3), 22_000);
    const toastId = toast.loading("Tedarik analizi yapılıyor (~30 saniye)...");
    try {
      const res = await apiFetch("/api/analyze-stocks", { method: "POST" });
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
        { id: toastId, duration: 6000 }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`Analiz hatası: ${msg}`);
    } finally {
      clearTimeout(t2);
      clearTimeout(t3);
      setCrewStep(0);
      setAnalyzing(false);
    }
  };

  const handleApprove = async (
    id: number,
    approval: PendingApproval,
    overrides: EmailOverrides,
  ) => {
    const product = (approval.payload.product_name as string) ?? "Ürün";
    const toastId = toast.loading(`${product} için e-posta gönderiliyor...`);
    try {
      const res = await apiFetch(`/api/actions/${id}/approve`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email_subject: overrides.subject,
          email_body:    overrides.body,
          recipient:     overrides.recipient,
        }),
      });
      if (!res.ok) throw new Error();
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
      await apiFetch(`/api/actions/${id}/reject`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({}),
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
              title="Kritik stokları analiz eder ve her ürün için tedarikçiye gönderilecek e-posta taslağı hazırlar (~30 sn)."
            >
              {analyzing
                ? <><Loader2 size={15} className="animate-spin" />Analiz yapılıyor...</>
                : <><Sparkles size={15} />Tedarik Analizi Yap</>
              }
            </button>

            {/* Crew step progress */}
            {analyzing && crewStep > 0 && (
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm text-xs">
                {[
                  { step: 1, icon: Search,     label: "Stok Analisti"   },
                  { step: 2, icon: FileStack,  label: "Tedarik Plancı"  },
                  { step: 3, icon: Mail,        label: "E-posta Taslakçı" },
                ].map(({ step, icon: Icon, label }, idx) => {
                  const done   = crewStep > step;
                  const active = crewStep === step;
                  return (
                    <div key={step} className="flex items-center gap-1.5">
                      {idx > 0 && (
                        <span className={`w-4 h-px ${done ? "bg-brand-400" : "bg-slate-200"}`} />
                      )}
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
                        done    ? "bg-brand-50 text-brand-600" :
                        active  ? "bg-purple-50 text-purple-700 ring-1 ring-purple-200" :
                                  "text-slate-300"
                      }`}>
                        {active
                          ? <Loader2 size={11} className="animate-spin" />
                          : <Icon size={11} className={done ? "text-brand-500" : ""} />
                        }
                        <span className="font-medium hidden sm:inline">{label}</span>
                        <span className="font-medium sm:hidden">{step}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Critical Alert Banner ──────────────────────────────────── */}
        {!loading && data?.stock_levels && (
          <CriticalAlertBanner stocks={data.stock_levels} />
        )}

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

        {/* ── Main Content ────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Stok Seviyeleri + AI Crew side-by-side */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

            {/* Left column: table + summary stats */}
            <div className="xl:col-span-2 space-y-4">
              <StockTable stocks={data?.stock_levels ?? []} loading={loading} />

              {!loading && trends.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      icon: PackageCheck,
                      label: "7 Günde Giriş",
                      value: `${trends.filter(t => t.total_in_7d > 0).length} ürün`,
                      color: "text-gsuccess-600 bg-gsuccess-50",
                    },
                    {
                      icon: TrendingDown,
                      label: "7 Günde Çıkış",
                      value: `${trends.filter(t => t.total_out_7d > 0).length} ürün`,
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

            {/* Right column: mail suggestions */}
            <div className="xl:col-span-1">
              <ApprovalPanel
                approvals={data?.pending_approvals ?? []}
                loading={loading}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </div>

          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="mt-12 pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
          <span>Tire Tarım Kooperatifi · KOBI Tarım Asistanı v4.0</span>
          <span>Gemini 2.5 Flash · CrewAI · FastAPI · Next.js</span>
        </footer>
      </div>
    </div>
  );
}
