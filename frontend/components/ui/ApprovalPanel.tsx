"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Mail,
  Inbox,
  ChevronDown,
  ChevronUp,
  Package,
  Loader2,
  Pencil,
  X,
  Bot,
  TrendingDown,
  ShoppingCart,
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
  agent_analysis?: AgentAnalysis;
  generated_by?: string;
  // legacy fields from original seed data
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

// ── Agent Insight Bar ──────────────────────────────────────────────────────

const URGENCY_STYLES = {
  HIGH:   "text-red-400 bg-red-500/10 border-red-500/25",
  MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25",
  LOW:    "text-brand-400 bg-brand-500/10 border-brand-500/25",
} as const;

function AgentInsightBar({ analysis }: { analysis: AgentAnalysis }) {
  const level = analysis.urgency_level ?? "MEDIUM";
  const colorClass = URGENCY_STYLES[level];

  return (
    <div className="mx-4 mb-1 rounded-lg bg-[#0a1209] border border-[rgba(34,197,94,0.07)] px-3 py-2 space-y-1.5">
      {/* Top row: urgency badge + recommended qty + fill % */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1">
          <Bot size={10} className="text-slate-500" />
          <span className="text-[9px] text-slate-600 font-medium uppercase tracking-wider">AI Crew</span>
        </span>

        <span className={clsx(
          "text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
          colorClass
        )}>
          {analysis.urgency_label ?? level}
        </span>

        {analysis.recommended_order_qty !== undefined && (
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <ShoppingCart size={10} className="text-slate-500" />
            Önerilen: <strong className="text-white ml-0.5">{analysis.recommended_order_qty}</strong>
          </span>
        )}

        {analysis.stock_ratio !== undefined && (
          <span className="flex items-center gap-1 text-[10px] text-slate-600 font-mono ml-auto">
            <TrendingDown size={10} />
            {Math.round(analysis.stock_ratio * 100)}% dolu
          </span>
        )}
      </div>

      {/* Reasoning */}
      {analysis.reasoning && (
        <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">
          {analysis.reasoning}
        </p>
      )}
    </div>
  );
}

// ── Single approval card ───────────────────────────────────────────────────

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

  const initialSubject   = p.email_subject ?? p.subject   ?? "Tedarik Talebi";
  const initialBody      = p.email_body    ?? p.body      ?? "";
  const initialRecipient = p.recipient     ?? "tedarikci@example.com";

  const [expanded,  setExpanded]  = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const [draftSubject,   setDraftSubject]   = useState(initialSubject);
  const [draftBody,      setDraftBody]      = useState(initialBody);
  const [draftRecipient, setDraftRecipient] = useState(initialRecipient);

  const product = p.product_name ?? "Ürün";
  const isSupplyEmail =
    approval.type === "supply_email" || approval.type === "supply_recommendation";

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

  const handleToggleExpand = () => {
    setExpanded(v => !v);
    if (expanded) setIsEditing(false);
  };

  return (
    <div className="rounded-xl border border-yellow-500/15 bg-[#131a0f] overflow-hidden">

      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400">
          <Mail size={14} />
        </div>

        <div className="flex-1 min-w-0">
          {isSupplyEmail && p.product_name && (
            <div className="flex items-center gap-2 mb-1.5">
              <Package size={11} className="text-slate-500 flex-shrink-0" />
              <span className="text-xs text-slate-400 truncate">
                <span className="text-red-400 font-medium">{product}</span>
                {p.current_stock !== undefined && (
                  <span className="text-slate-600">
                    {" "}· {p.current_stock} / {p.threshold} {p.unit}
                  </span>
                )}
              </span>
            </div>
          )}

          <p className="text-white text-xs font-semibold leading-snug line-clamp-2">
            {draftSubject}
          </p>
          <p className="text-slate-600 text-xs mt-1 font-mono truncate">
            → {draftRecipient}
          </p>
        </div>
      </div>

      {/* Agent insight — only when CrewAI generated this approval */}
      {p.agent_analysis && <AgentInsightBar analysis={p.agent_analysis} />}

      {/* Expandable section */}
      <div className="px-4 pb-3">

        {/* Toggle bar */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={handleToggleExpand}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? "E-postayı gizle" : "E-postayı önizle"}
          </button>

          {expanded && (
            <button
              onClick={() => setIsEditing(v => !v)}
              className={clsx(
                "flex items-center gap-1 text-xs transition-colors rounded px-1.5 py-0.5",
                isEditing
                  ? "text-brand-400 bg-brand-500/10"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {isEditing ? <X size={11} /> : <Pencil size={11} />}
              {isEditing ? "Önizle" : "Düzenle"}
            </button>
          )}
        </div>

        {/* Preview or edit pane */}
        {expanded && (
          <div className="rounded-lg border border-[rgba(34,197,94,0.06)] bg-[#0e1410] p-3 mb-3">
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Alıcı</label>
                  <input
                    value={draftRecipient}
                    onChange={e => setDraftRecipient(e.target.value)}
                    className="w-full bg-[#131a0f] border border-[rgba(34,197,94,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-brand-500/40 transition-colors"
                    placeholder="tedarikci@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">Konu</label>
                  <input
                    value={draftSubject}
                    onChange={e => setDraftSubject(e.target.value)}
                    className="w-full bg-[#131a0f] border border-[rgba(34,197,94,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500/40 transition-colors"
                    placeholder="E-posta konusu"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium block mb-1">İçerik</label>
                  <textarea
                    value={draftBody}
                    onChange={e => setDraftBody(e.target.value)}
                    rows={8}
                    className="w-full bg-[#131a0f] border border-[rgba(34,197,94,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-sans leading-relaxed focus:outline-none focus:border-brand-500/40 transition-colors resize-y max-h-64"
                    placeholder="E-posta içeriği"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-[rgba(34,197,94,0.06)] pb-2 mb-2 space-y-0.5">
                  <p className="text-xs text-slate-600">
                    <span className="text-slate-500 font-medium">Konu: </span>
                    {draftSubject}
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className="text-slate-500 font-medium">Alıcı: </span>
                    {draftRecipient}
                  </p>
                </div>
                <pre className="text-xs text-slate-400 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
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
            disabled={approving || rejecting}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-lg transition-all",
              "bg-brand-500/15 text-brand-400 border border-brand-500/25",
              "hover:bg-brand-500/25 hover:shadow-lg hover:shadow-brand-900/30",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {approving ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <CheckCircle size={11} />
            )}
            Onayla ve Gönder
          </button>

          <button
            onClick={handleReject}
            disabled={approving || rejecting}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-lg transition-all",
              "bg-red-500/10 text-red-400 border border-red-500/20",
              "hover:bg-red-500/20",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {rejecting ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <XCircle size={11} />
            )}
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────

export default function ApprovalPanel({ approvals, loading, onApprove, onReject }: Props) {
  const hasCrewResults = approvals.some(
    (a) => (a.payload as EmailPayload)?.generated_by === "crewai_v1"
  );

  return (
    <div className="card-glow rounded-xl bg-[#111a14] border border-[rgba(34,197,94,0.08)] overflow-hidden h-fit">

      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(34,197,94,0.08)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasCrewResults ? (
            <Bot size={14} className="text-brand-500" />
          ) : (
            <Mail size={14} className="text-brand-500" />
          )}
          <h2 className="text-white font-semibold text-sm">
            {hasCrewResults ? "AI Crew Analizi" : "Onay Bekleyenler"}
          </h2>
        </div>

        {approvals.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            {approvals.length} bekliyor
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl bg-[#1a2520] h-28" />
            ))}
          </div>
        ) : approvals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-600">
            <Inbox size={30} strokeWidth={1} className="mb-2.5" />
            <p className="text-sm">Bekleyen onay yok</p>
            <p className="text-xs text-slate-700 mt-1 text-center">
              Analiz başlatın veya stok kritik seviyeye düşmesini bekleyin
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.map((a) => (
              <ApprovalCard
                key={a.id}
                approval={a}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
