"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell, X, CheckCheck, Package, Mail, Brain,
  AlertTriangle, Info, Ban, RefreshCw, Check,
} from "lucide-react";
import { clsx } from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Notification {
  id: number;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  stock_update: { icon: Package,       color: "text-brand-600",  bg: "bg-brand-50"  },
  email_sent:   { icon: Mail,          color: "text-blue-600",   bg: "bg-blue-50"   },
  ai_analysis:  { icon: Brain,         color: "text-purple-600", bg: "bg-purple-50" },
  alert:        { icon: AlertTriangle, color: "text-red-600",    bg: "bg-red-50"    },
  rejection:    { icon: Ban,           color: "text-amber-600",  bg: "bg-amber-50"  },
  info:         { icon: Info,          color: "text-slate-500",  bg: "bg-slate-50"  },
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "şimdi";
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return `${Math.floor(diff / 86400)} gün önce`;
}

export default function NotificationBar() {
  const [open, setOpen] = useState(false);
  // Only keep unread notifications in state — read ones are removed immediately
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/notifications`);
      if (!res.ok) return;
      const data: Notification[] = await res.json();
      // Panel shows only unread notifications
      setNotifications(data.filter(n => !n.is_read));
    } catch {
      // API not available — silently ignore
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleMarkOne = async (id: number) => {
    setMarkingId(id);
    try {
      await fetch(`${API}/api/notifications/${id}/read`, { method: "PATCH" });
      // Remove from panel immediately
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {
      // ignore
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${API}/api/notifications/read-all`, { method: "PATCH" });
      setNotifications([]);
    } catch {
      // ignore
    }
  };

  const unread = notifications.length;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={clsx(
          "relative p-2 rounded-lg transition-colors",
          open
            ? "bg-brand-50 text-brand-700"
            : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        )}
        title="Bildirimler"
      >
        <Bell size={18} strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 text-[9px] font-bold bg-red-500 text-white rounded-full">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 flex flex-col max-h-[520px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-slate-600" />
              <span className="text-sm font-semibold text-slate-800">Bildirimler</span>
              {unread > 0 && (
                <span className="text-xs font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                  {unread} yeni
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
                  title="Tümünü okundu işaretle"
                >
                  <CheckCheck size={12} />
                  <span className="hidden sm:inline">Tümünü oku</span>
                </button>
              )}
              <button
                onClick={fetchNotifications}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Yenile"
              >
                <RefreshCw size={12} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                <Bell size={28} strokeWidth={1} />
                <p className="text-xs mt-2">Tüm bildirimler okundu</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
                const IconComp = cfg.icon;
                const isMarking = markingId === n.id;
                return (
                  <div
                    key={n.id}
                    className="flex gap-3 px-4 py-3 border-b border-slate-50 last:border-0 bg-slate-50/70 hover:bg-slate-100/60 transition-colors group"
                  >
                    <div className={clsx("flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5", cfg.bg)}>
                      <IconComp size={13} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-snug text-slate-800">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{n.body}</p>
                      )}
                      <p className="text-[10px] text-slate-300 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {/* Per-notification mark-as-read button */}
                    <button
                      onClick={() => handleMarkOne(n.id)}
                      disabled={isMarking}
                      className={clsx(
                        "flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5 transition-all",
                        isMarking
                          ? "bg-green-100 text-green-500"
                          : "opacity-0 group-hover:opacity-100 bg-slate-100 hover:bg-green-100 text-slate-400 hover:text-green-600"
                      )}
                      title="Okundu olarak işaretle"
                    >
                      <Check size={11} strokeWidth={2.5} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
