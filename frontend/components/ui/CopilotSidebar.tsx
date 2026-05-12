"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Sparkles, Send, Loader2, Bot, MessageSquare,
} from "lucide-react";
import { clsx } from "clsx";
import { apiFetch } from "@/lib/auth";
import { useCopilot } from "@/components/CopilotContext";
import type { PendingApproval } from "@/app/page";

// ── Types ──────────────────────────────────────────────────────────────────

type MessageVariant = "success" | "warning" | "error";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  variant?: MessageVariant;
}

interface DashboardSlice {
  pending_approvals: PendingApproval[];
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-brand-600 text-white px-4 py-2.5 text-sm leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  const variantClass: Record<MessageVariant, string> = {
    success: "bg-gsuccess-50 border border-gsuccess-200 text-gsuccess-800",
    warning: "bg-amber-50 border border-amber-200 text-amber-800",
    error:   "bg-red-50 border border-red-200 text-red-700",
  };

  return (
    <div className="flex items-start gap-2">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center mt-0.5">
        <Bot size={13} className="text-brand-600" />
      </div>
      <div
        className={clsx(
          "max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed",
          msg.variant ? variantClass[msg.variant] : "bg-slate-100 text-slate-700"
        )}
      >
        {msg.text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center">
        <Bot size={13} className="text-brand-600" />
      </div>
      <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 150, 300].map(delay => (
          <span
            key={delay}
            className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function WelcomeState({ onSuggest }: { onSuggest: (text: string) => void }) {
  const examples = [
    { text: "500 kg buğday teslim alındı",  hint: "Stok girişi" },
    { text: "100 litre mazot çıktı",         hint: "Stok çıkışı" },
    { text: "Mevcut stok durumu nasıl?",     hint: "Soru" },
    { text: "Naber?",                        hint: "Sohbet" },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-4 shadow-lg">
        <Sparkles size={24} className="text-white" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1.5">
        Merhaba, KOBI burada!
      </h3>
      <p className="text-xs text-slate-400 leading-relaxed mb-5 max-w-[260px]">
        Stok güncellemesi, soru ya da sadece sohbet —
        her şeyi doğal Türkçe ile yazabilirsiniz.
      </p>
      <div className="flex flex-col gap-2 w-full">
        {examples.map(({ text, hint }) => (
          <button
            key={text}
            onClick={() => onSuggest(text)}
            className="text-left text-xs px-3.5 py-2.5 rounded-xl border border-slate-200
                       hover:border-brand-300 hover:bg-brand-50 text-slate-600
                       hover:text-brand-700 transition-colors flex items-center gap-2 group"
          >
            <span className="flex-1">&ldquo;{text}&rdquo;</span>
            <span className="text-[10px] text-slate-400 group-hover:text-brand-400 shrink-0 font-medium">
              {hint}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Sidebar ───────────────────────────────────────────────────────────

export default function CopilotSidebar() {
  const { isOpen, close, setPendingCount } = useCopilot();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);

  const feedRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Keep badge count updated ──────────────────────────────────────────────

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await apiFetch("/api/dashboard");
      if (!res.ok) return;
      const data: DashboardSlice = await res.json();
      setPendingCount((data.pending_approvals ?? []).length);
    } catch {
      // silently ignore
    }
  }, [setPendingCount]);

  useEffect(() => {
    fetchPendingCount();
    const id = setInterval(fetchPendingCount, 10_000);
    return () => clearInterval(id);
  }, [fetchPendingCount]);

  // ── Auto-scroll feed ─────────────────────────────────────────────────────

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // ── Focus input when sidebar opens ───────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 320);
    }
  }, [isOpen]);

  // ── Chat send ────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await apiFetch("/api/webhook/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json() as { status: string; message: string };

      const aiMsg: ChatMessage = {
        id:   `a-${Date.now()}`,
        role: "ai",
        text: data.message ?? "Anlayamadım, tekrar dener misiniz?",
        // "chat" status → no color variant (plain gray bubble)
        variant:
          data.status === "error"   ? "error"
        : data.status === "warning" ? "warning"
        : data.status === "success" ? "success"
        : undefined,
      };
      setMessages(prev => [...prev, aiMsg]);

      if (data.status === "success") fetchPendingCount();
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "ai",
          text: "Bağlantı hatası. Backend çalışıyor mu?",
          variant: "error",
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, fetchPendingCount]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        className={clsx(
          "fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className={clsx(
          "fixed inset-y-0 right-0 w-[400px] max-w-full bg-white shadow-2xl z-50",
          "flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="AI Asistan"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-brand-600 to-brand-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/20">
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">KOBI AI Asistan</p>
              <p className="text-[10px] text-brand-200 leading-none mt-0.5">
                Stok komutları · Serbest sohbet
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-colors"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Feed area ────────────────────────────────────────────────── */}
        <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-3">

          {messages.length > 0 ? (
            <>
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              {sending && <TypingIndicator />}
            </>
          ) : (
            <WelcomeState
              onSuggest={text => {
                setInput(text);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
            />
          )}
        </div>

        {/* ── Input area ───────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MessageSquare
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Stok komutu veya soru yazın..."
                className="form-input pl-9 text-sm"
                disabled={sending}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="btn-primary h-10 w-10 flex-shrink-0 justify-center px-0"
              aria-label="Gönder"
            >
              {sending
                ? <Loader2 size={15} className="animate-spin" />
                : <Send size={15} />
              }
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            &ldquo;500 kg buğday teslim alındı&rdquo; yazın — AI stok kaydını otomatik oluşturur
          </p>
        </div>
      </aside>
    </>
  );
}
