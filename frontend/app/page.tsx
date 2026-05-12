"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import KpiCard from "@/components/ui/KpiCard";
import StockTable from "@/components/ui/StockTable";
import ApprovalPanel, { type EmailOverrides } from "@/components/ui/ApprovalPanel";
import { DaysToEmptyChart, WeeklyFlowChart, type DailyProduct } from "@/components/ui/StockCharts";
import {
  Boxes, AlertTriangle, Clock, Activity,
  Wifi, WifiOff, Sparkles, Loader2, RefreshCw,
  TrendingDown, PackageCheck, BarChart3, CalendarClock,
  X, Send, MessageSquare, ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/lib/auth";

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

// ── Quick Stock Entry ──────────────────────────────────────────────────────

interface QuickEntryResponse {
  status: string;
  message: string;
}

function QuickStockEntry({ onSuccess }: { onSuccess: () => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickEntryResponse | null>(null);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await apiFetch("/api/webhook/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data: QuickEntryResponse = await res.json();
      setResult(data);
      if (data.status === "success") {
        setText("");
        onSuccess();
      }
    } catch {
      setResult({ status: "error", message: "Bağlantı hatası. Tekrar deneyin." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={14} className="text-brand-600" />
        <h3 className="section-title">Hızlı Stok Girişi</h3>
        <span className="text-xs text-slate-400 ml-auto">AI · doğal dil</span>
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => { setText(e.target.value); setResult(null); }}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          placeholder="örn: 500 kg buğday teslim alındı"
          className="form-input flex-1 h-10"
          disabled={loading}
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || loading}
          className="btn-primary h-10 px-4"
          title="Gönder (Enter)"
        >
          {loading
            ? <Loader2 size={15} className="animate-spin" />
            : <Send size={15} />
          }
        </button>
      </div>
      {result && (
        <p className={`text-xs mt-2 font-medium ${
          result.status === "success" ? "text-gsuccess-700" :
          result.status === "warning" ? "text-amber-700" : "text-red-600"
        }`}>
          {result.message}
        </p>
      )}
      <p className="text-xs text-slate-400 mt-2">
        WhatsApp&apos;a yazdığınız gibi yazın — AI stok kaydını otomatik oluşturur
      </p>
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
  const [history, setHistory] = useState<DailyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

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
      if (trendRes.ok) setTrends(await trendRes.json());
      if (histRes.ok) setHistory(await histRes.json());
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
    const interval = setInterval(fetchDashboard, 10_000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
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
          ? `Analiz tamamlandı — ${count} kritik ürün için tedarik talebi oluşturuldu.`
          : "Analiz tamamlandı — tüm stoklar yeterli seviyede.",
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
      const res = await apiFetch(`/api/actions/${id}/approve`, {
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
      await apiFetch(`/api/actions/${id}/reject`, {
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

        {/* ── Main Content Grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Stock table (2/3) */}
          <div className="xl:col-span-2 space-y-6">
            <StockTable stocks={data?.stock_levels ?? []} loading={loading} />

            {/* Quick stock entry */}
            <QuickStockEntry onSuccess={fetchDashboard} />

            {/* Charts */}
            {!loading && trends.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Days-to-empty */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <CalendarClock size={15} className="text-brand-600" />
                      <h2 className="section-title">Tahmini Stok Ömrü</h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Mevcut tüketim hızına göre kaç gün dayanır
                    </p>
                  </div>
                  <div className="px-4 pt-3 pb-4">
                    <DaysToEmptyChart trends={trends} />
                  </div>
                </div>

                {/* Weekly flow */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={15} className="text-brand-600" />
                      <h2 className="section-title">Haftalık Stok Hareketi</h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Son 7 günde toplam giriş ve çıkış
                    </p>
                  </div>
                  <div className="px-4 pt-3 pb-4">
                    <WeeklyFlowChart history={history} />
                  </div>
                </div>

              </div>
            )}

            {/* Summary stats */}
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
          <span>Tire Tarım Kooperatifi · KOBI Tarım Asistanı v4.0</span>
          <span>Gemini 2.5 Flash · CrewAI · FastAPI · Next.js</span>
        </footer>
      </div>
    </div>
  );
}
