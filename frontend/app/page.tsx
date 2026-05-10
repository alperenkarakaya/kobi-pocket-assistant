"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import KpiCard from "@/components/ui/KpiCard";
import StockTable from "@/components/ui/StockTable";
import ApprovalPanel, { type EmailOverrides } from "@/components/ui/ApprovalPanel";
import {
  Boxes,
  AlertTriangle,
  Clock,
  TrendingUp,
  Wifi,
  WifiOff,
  Sparkles,
  Loader2,
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
}

export interface PendingApproval {
  id: number;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface DashboardData {
  kpis: Kpi[];
  stock_levels: StockLevel[];
  pending_approvals: PendingApproval[];
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const KPI_ICONS = [Boxes, AlertTriangle, Clock, TrendingUp];

// ── Skeleton ───────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="card-glow rounded-xl bg-[#111a14] border border-[rgba(34,197,94,0.08)] p-6 animate-pulse">
      <div className="h-4 w-24 bg-[#1e2d22] rounded mb-4" />
      <div className="h-9 w-16 bg-[#1e2d22] rounded mb-2" />
      <div className="h-3 w-12 bg-[#1e2d22] rounded" />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // ── Fetch dashboard ─────────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/dashboard`);
      if (!res.ok) throw new Error("API error");
      const json: DashboardData = await res.json();
      setData(json);
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

  // ── AI Analysis ─────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    setAnalyzing(true);
    const toastId = toast.loading("AI Crew analiz yapıyor (~30 saniye)...");
    try {
      const res = await fetch(`${API}/api/analyze-stocks`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Analiz başarısız");
      }
      const approvals: PendingApproval[] = await res.json();
      await fetchDashboard();

      const newCount = approvals.length;
      toast.success(
        newCount > 0
          ? `🤖 AI Crew tamamlandı — ${newCount} kritik ürün için tedarik talebi oluşturuldu.`
          : "✅ AI Crew tamamlandı — tüm stoklar yeterli seviyede.",
        { id: toastId }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`Analiz hatası: ${msg}`, { id: toastId });
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Approve ─────────────────────────────────────────────────────────────

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
      toast.success(`📧 E-posta gönderildi — ${product} tedarik talebi onaylandı.`, {
        id: toastId,
        duration: 6000,
      });
    } catch {
      toast.error("E-posta gönderilemedi. Tekrar deneyin.", { id: toastId });
    }
  };

  // ── Reject ──────────────────────────────────────────────────────────────

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
    { label: "Total Products", value: "--" },
    { label: "Low Stock Alerts", value: "--" },
    { label: "Pending Approvals", value: "--" },
    { label: "Today's Movements", value: "--" },
  ];

  const kpis = data?.kpis ?? fallbackKpis;

  return (
    <div className="min-h-screen bg-[#0a0f0d] bg-grid-pattern bg-grid-sm relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(34,197,94,0.08),transparent)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="flex items-start justify-between mb-10 gap-4 flex-wrap">
          <div>
            <span className="text-xs font-semibold tracking-widest text-brand-500 uppercase">
              KOBI Pocket Assistant
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-white text-glow-green tracking-tight mt-1">
              Tire Cooperative Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1.5">
              AI-powered inventory management • Real-time stock tracking
            </p>
          </div>

          <div className="flex flex-col items-end gap-3 mt-1">
            {/* AI Analysis button — the demo centerpiece */}
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                bg-gradient-to-r from-brand-600/80 to-emerald-600/80
                border border-brand-500/30 text-white
                hover:from-brand-600 hover:to-emerald-600
                disabled:opacity-60 disabled:cursor-not-allowed
                shadow-lg shadow-brand-900/30 transition-all duration-200"
            >
              {analyzing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              {analyzing ? "Crew çalışıyor..." : "AI Crew Analizi Başlat"}
            </button>

            {/* Live status */}
            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border
              ${apiError
                ? "text-red-400 border-red-500/20 bg-red-500/10"
                : "text-brand-400 border-brand-500/20 bg-brand-500/10"
              }`}>
              {apiError ? <WifiOff size={12} /> : <Wifi size={12} />}
              {apiError ? "API Offline" : "Live"}
            </div>
            {lastUpdated && (
              <span className="text-xs text-slate-500">
                Updated {lastUpdated.toLocaleTimeString("tr-TR")}
              </span>
            )}
          </div>
        </header>

        {/* ── KPI Cards ──────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
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
        </section>

        {/* ── Main Content ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <StockTable stocks={data?.stock_levels ?? []} loading={loading} />
          </div>

          <div className="xl:col-span-1">
            <ApprovalPanel
              approvals={data?.pending_approvals ?? []}
              loading={loading}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </div>
        </div>

        <footer className="mt-12 pt-6 border-t border-[rgba(34,197,94,0.08)] text-center text-xs text-slate-600">
          Powered by Gemini 2.5 Flash • FastAPI • Next.js 13
        </footer>
      </div>
    </div>
  );
}
