"use client";

import { useState } from "react";
import { Leaf, Loader2, Lock, User } from "lucide-react";
import { setToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Giriş başarısız.");
        return;
      }
      const { access_token } = await res.json();
      setToken(access_token);
      window.location.href = "/";
    } catch {
      setError("Sunucuya bağlanılamadı. Backend çalışıyor mu?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 shadow-lg mb-4">
            <Leaf size={28} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">KOBI Tarım Asistanı</h1>
          <p className="text-slate-500 text-sm mt-1">Tire Tarım Kooperatifi · Yönetim Paneli</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card-lg p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">Giriş Yap</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Kullanıcı Adı
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(""); }}
                  placeholder="admin"
                  className="form-input pl-9"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Şifre
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  className="form-input pl-9"
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!username.trim() || !password.trim() || loading}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" />Giriş yapılıyor...</>
                : "Giriş Yap"
              }
            </button>
          </form>
        </div>

        {/* Demo credentials hint */}
        <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-center">
          <p className="text-xs font-semibold text-brand-700 mb-1">Demo Girişi</p>
          <p className="text-xs text-brand-600">
            Kullanıcı: <span className="font-mono font-bold">admin</span>
            &nbsp;·&nbsp;
            Şifre: <span className="font-mono font-bold">kobi2025</span>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Tire Tarım Kooperatifi · AI destekli stok yönetimi
        </p>
      </div>
    </div>
  );
}
