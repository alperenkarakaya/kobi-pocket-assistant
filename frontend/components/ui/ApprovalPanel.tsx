"use client";

import { useState } from "react";
import {
  CheckCircle, XCircle, Mail, Inbox, ChevronDown, ChevronUp,
  Package, Loader2, Pencil, X, Bot, TrendingDown, ShoppingCart,
  AlertTriangle, AlertCircle, Info, RefreshCw, Zap, Briefcase, Smile,
} from "lucide-react";
import { clsx } from "clsx";
import type { PendingApproval } from "@/app/page";

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentAnalysis {
  stock_ratio?: number;
  deficit?: number;
  urgency_level?: "HIGH" | "MEDIUM" | "LOW";
  urgency_label?: string;
  recommended_order_qty?: number;
  reasoning?: string;
}

interface EmailPayload {
  product_name?: string;
  product_id?: number;
  current_stock?: number;
  threshold?: number;
  unit?: string;
  email_subject?: string;
  email_body?: string;
  recipient?: string;
  supplier_name?: string;
  agent_analysis?: AgentAnalysis;
  generated_by?: string;
  subject?: string;
  body?: string;
}

export interface EmailOverrides {
  subject: string;
  body: string;
  recipient: string;
}

interface Props {
  approvals: PendingApproval[];
  loading: boolean;
  onApprove: (id: number, approval: PendingApproval, overrides: EmailOverrides) => Promise<void>;
  onReject: (id: number, approval: PendingApproval) => Promise<void>;
}

// ── Urgency config ─────────────────────────────────────────────────────────

const URGENCY = {
  HIGH:   { icon: AlertTriangle, badge: "badge-critical", dot: "bg-red-500",      label: "Kritik" },
  MEDIUM: { icon: AlertCircle,   badge: "badge-warning",  dot: "bg-amber-500",    label: "Orta"   },
  LOW:    { icon: Info,          badge: "badge-ok",       dot: "bg-gsuccess-500", label: "Düşük"  },
} as const;

// ── Tone options ───────────────────────────────────────────────────────────

const TONES = [
  { key: "urgent",   label: "Acil",   icon: Zap,       desc: "Baskılayıcı, hızlı yanıt talep eder" },
  { key: "formal",   label: "Resmi",  icon: Briefcase, desc: "Kurumsal, standart iş dili"           },
  { key: "friendly", label: "Samimi", icon: Smile,     desc: "Sıcak ama profesyonel"                },
] as const;

// ── Agent Insight Strip ────────────────────────────────────────────────────

function AgentInsightStrip({ analysis, unit }: { analysis: AgentAnalysis; unit?: string }) {
  const level = (analysis.urgency_level ?? "MEDIUM") as keyof typeof URGENCY;
  const cfg = URGENCY[level];
  const UIcon = cfg.icon;

  return (
    <div className="mx-4 mb-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Bot size={11} />
          <span className="font-medium uppercase tracking-wide">AI Crew</span>
        </div>

        <span className={clsx("inline-flex items-center gap-1", cfg.badge)}>
          <UIcon size={10} />
          {analysis.urgency_label ?? cfg.label}
        </span>

        {analysis.recommended_order_qty !== undefined && (
          <span className="flex items-center gap-1 text-xs text-slate-600 font-medium ml-auto">
            <ShoppingCart size={11} className="text-slate-400" />
            Öneri: <strong className="text-slate-800 ml-0.5">{analysis.recommended_order_qty} {unit ?? ""}</strong>
          </span>
        )}

        {analysis.stock_ratio !== undefined && (
          <span className="flex items-center gap-1 text-xs text-slate-400 font-mono">
            <TrendingDown size={10} />
            {Math.round((analysis.stock_ratio ?? 0) * 100)}% dolu
          </span>
        )}
      </div>

      {analysis.reasoning && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
          {analysis.reasoning}
        </p>
      )}
    </div>
  );
}

// ── Single Approval Card ───────────────────────────────────────────────────

function ApprovalCard({
  approval,
  onApprove,
  onReject,
}: {
  approval: PendingApproval;
  onApprove: (id: number, a: PendingApproval, overrides: EmailOverrides) => Promise<void>;
  onReject: (id: number, a: PendingApproval) => Promise<void>;
}) {
  const p = approval.payload as EmailPayload;

  const initSubject   = p.email_subject ?? p.subject   ?? "Tedarik Talebi";
  const initBody      = p.email_body    ?? p.body      ?? "";
  const initRecipient = p.recipient     ?? "tedarikci@example.com";

  const [expanded,      setExpanded]      = useState(false);
  const [isEditing,     setIsEditing]     = useState(false);
  const [approving,     setApproving]     = useState(false);
  const [rejecting,     setRejecting]     = useState(false);
  const [regenerating,  setRegenerating]  = useState(false);
  const [showTones,     setShowTones]     = useState(false);

  const [draftSubject,   setDraftSubject]   = useState(initSubject);
  const [draftBody,      setDraftBody]      = useState(initBody);
  const [draftRecipient, setDraftRecipient] = useState(initRecipient);

  const product = p.product_name ?? "Ürün";
  const urgency = (p.agent_analysis?.urgency_level ?? "MEDIUM") as keyof typeof URGENCY;
  const urgencyCfg = URGENCY[urgency];

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApprove(approval.id, approval, {
        subject: draftSubject,
        body: draftBody,
        recipient: draftRecipient,
      });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try { await onReject(approval.id, approval); } finally { setRejecting(false); }
  };

  const handleRegenerate = async (tone: string) => {
    setShowTones(false);
    setRegenerating(true);
    if (!expanded) setExpanded(true);
    try {
      const res = await fetch(`/api/actions/${approval.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone }),
      });
      if (!res.ok) throw new Error("Yeniden yazma başarısız");
      const data: { subject: string; body: string } = await res.json();
      setDraftSubject(data.subject);
      setDraftBody(data.body);
      setIsEditing(false);
    } catch {
      // silently ignore — user can retry
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">

      {/* Card header */}
      <div className={clsx(
        "px-4 py-3 border-b flex items-start gap-3",
        urgency === "HIGH"   ? "bg-red-50 border-red-100" :
        urgency === "MEDIUM" ? "bg-amber-50 border-amber-100" :
                               "bg-slate-50 border-slate-100"
      )}>
        <div className={clsx(
          "flex-shrink-0 mt-0.5 p-1.5 rounded-lg",
          urgency === "HIGH"   ? "bg-red-100 text-red-600" :
          urgency === "MEDIUM" ? "bg-amber-100 text-amber-600" :
          "bg-gsuccess-100 text-gsuccess-600"
        )}>
          <Mail size={14} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Package size={11} className="text-slate-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-700 truncate">{product}</span>
            {p.current_stock !== undefined && (
              <span className="text-xs text-slate-400 flex-shrink-0">
                {p.current_stock}/{p.threshold} {p.unit}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 font-medium leading-snug line-clamp-2">
            {draftSubject}
          </p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {p.supplier_name
              ? <><span className="font-medium text-slate-500">{p.supplier_name}</span><span className="font-mono ml-1">{'<'}{draftRecipient}{'>'}</span></>
              : <span className="font-mono">→ {draftRecipient}</span>
            }
          </p>
        </div>

        <span className={clsx("flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
          urgency === "HIGH"   ? "bg-red-100 text-red-700 border-red-200" :
          urgency === "MEDIUM" ? "bg-amber-100 text-amber-700 border-amber-200" :
          "bg-gsuccess-100 text-gsuccess-700 border-gsuccess-200"
        )}>
          <span className={clsx("w-1.5 h-1.5 rounded-full", urgencyCfg.dot)} />
          {p.agent_analysis?.urgency_label ?? urgencyCfg.label}
        </span>
      </div>

      {/* Agent insight */}
      {p.agent_analysis && (
        <div className="pt-3">
          <AgentInsightStrip analysis={p.agent_analysis} unit={p.unit} />
        </div>
      )}

      {/* Toggle + preview/edit */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => { setExpanded(v => !v); if (expanded) setIsEditing(false); }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors font-medium"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? "E-postayı gizle" : "E-postayı önizle"}
          </button>

          <div className="flex items-center gap-1">
            {/* Tone regeneration */}
            <div className="relative">
              <button
                onClick={() => setShowTones(v => !v)}
                disabled={regenerating}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-purple-600 hover:bg-purple-50 transition-colors font-medium disabled:opacity-50"
                title="Farklı tonla yeniden yaz"
              >
                {regenerating
                  ? <Loader2 size={11} className="animate-spin" />
                  : <RefreshCw size={11} />
                }
                Yeniden Yaz
              </button>

              {showTones && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                  {TONES.map(t => {
                    const TIcon = t.icon;
                    return (
                      <button
                        key={t.key}
                        onClick={() => handleRegenerate(t.key)}
                        className="w-full flex items-start gap-2 px-3 py-2 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg transition-colors text-left"
                      >
                        <TIcon size={13} className="text-slate-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{t.label}</p>
                          <p className="text-[10px] text-slate-400">{t.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {expanded && (
              <button
                onClick={() => setIsEditing(v => !v)}
                className={clsx(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors font-medium",
                  isEditing
                    ? "bg-brand-50 text-brand-700 border border-brand-200"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                )}
              >
                {isEditing ? <X size={11} /> : <Pencil size={11} />}
                {isEditing ? "Önizle" : "Düzenle"}
              </button>
            )}
          </div>
        </div>

        {regenerating && (
          <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 rounded-lg px-3 py-2 mb-2">
            <Loader2 size={12} className="animate-spin" />
            Gemini e-postayı yeniden yazıyor...
          </div>
        )}

        {expanded && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-3 text-xs">
            {isEditing ? (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Alıcı</label>
                  <input
                    value={draftRecipient}
                    onChange={e => setDraftRecipient(e.target.value)}
                    className="form-input text-xs py-2"
                    placeholder="tedarikci@example.com"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Konu</label>
                  <input
                    value={draftSubject}
                    onChange={e => setDraftSubject(e.target.value)}
                    className="form-input text-xs py-2"
                    placeholder="E-posta konusu"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">İçerik</label>
                  <textarea
                    value={draftBody}
                    onChange={e => setDraftBody(e.target.value)}
                    rows={7}
                    className="form-input text-xs py-2 resize-y max-h-56 font-sans leading-relaxed"
                    placeholder="E-posta içeriği"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-slate-200 pb-2 mb-2 space-y-1">
                  <p><span className="font-semibold text-slate-600">Konu: </span>{draftSubject}</p>
                  <p><span className="font-semibold text-slate-600">Alıcı: </span><span className="font-mono">{draftRecipient}</span></p>
                </div>
                <pre className="text-slate-600 whitespace-pre-wrap font-sans leading-relaxed max-h-44 overflow-y-auto">
                  {draftBody}
                </pre>
              </>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={approving || rejecting || regenerating}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3
                       rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {approving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
            Onayla ve Gönder
          </button>
          <button
            onClick={handleReject}
            disabled={approving || rejecting || regenerating}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3
                       rounded-lg bg-white text-red-600 border border-red-200 hover:bg-red-50
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rejecting ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
            Reddet
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────

const VISIBLE_DEFAULT = 2;

export default function ApprovalPanel({ approvals, loading, onApprove, onReject }: Props) {
  const [expanded, setExpanded] = useState(false);

  const visible    = expanded ? approvals : approvals.slice(0, VISIBLE_DEFAULT);
  const hiddenCount = approvals.length - VISIBLE_DEFAULT;

  return (
    <div className="card overflow-hidden flex flex-col h-fit">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-brand-600" />
          <h2 className="section-title">Mail Önerileri</h2>
        </div>

        {approvals.length > 0 && (
          <span className="badge-warning">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {approvals.length} bekliyor
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl bg-slate-100 h-28" />
            ))}
          </div>
        ) : approvals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <Inbox size={32} strokeWidth={1.5} className="mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">Bekleyen öneri yok</p>
            <p className="text-xs text-slate-400 mt-1 text-center">
              AI Crew analizi başlatın veya stok kritik seviyeye düşmesini bekleyin
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {visible.map((a) => (
                <ApprovalCard key={a.id} approval={a} onApprove={onApprove} onReject={onReject} />
              ))}
            </div>

            {hiddenCount > 0 && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="mt-3 w-full flex items-center justify-center gap-1.5
                           text-xs font-medium text-slate-500 hover:text-brand-600
                           py-2.5 rounded-lg border border-dashed border-slate-200
                           hover:border-brand-300 hover:bg-brand-50 transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp size={13} />
                    Daha az göster
                  </>
                ) : (
                  <>
                    <ChevronDown size={13} />
                    Daha fazlası için tıklayınız
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                      +{hiddenCount}
                    </span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
