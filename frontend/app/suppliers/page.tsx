"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Users, Mail, Phone, Tag, X, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";
import { apiFetch } from "@/lib/auth";

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  product_category: string | null;
  notes: string | null;
  created_at: string;
}

interface SupplierForm {
  name: string;
  email: string;
  phone: string;
  product_category: string;
  notes: string;
}

const EMPTY_FORM: SupplierForm = {
  name: "",
  email: "",
  phone: "",
  product_category: "",
  notes: "",
};

function SupplierSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
        <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
        <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {[32, 48, 28, 20, 40].map((w, i) => (
                <th key={i} className="px-4 py-3">
                  <div className={`h-3 w-${w} bg-slate-200 rounded animate-pulse`} />
                </th>
              ))}
              <th className="w-28" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {[1, 2, 3].map(i => (
              <tr key={i} style={{ opacity: i === 1 ? 1 : i === 2 ? 0.6 : 0.3 }}>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-200 animate-pulse flex-shrink-0" />
                    <div className="h-3.5 w-36 bg-slate-200 rounded animate-pulse" />
                  </div>
                </td>
                <td className="px-4 py-3.5"><div className="h-3 w-44 bg-slate-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3.5 hidden sm:table-cell"><div className="h-3 w-28 bg-slate-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3.5 hidden md:table-cell"><div className="h-5 w-20 bg-slate-200 rounded-full animate-pulse" /></td>
                <td className="px-4 py-3.5 hidden lg:table-cell"><div className="h-3 w-40 bg-slate-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3.5 w-28" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SupplierModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (s: Supplier) => void;
}) {
  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          product_category: form.product_category.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const supplier: Supplier = await res.json();
      onSaved(supplier);
      toast.success(`${supplier.name} tedarikçi listesine eklendi.`);
      onClose();
    } catch {
      toast.error("Tedarikçi eklenemedi. Tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-card-lg w-full max-w-md border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand-50">
              <Users size={14} className="text-brand-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-800">Yeni Tedarikçi Ekle</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Firma Adı *</label>
            <input
              autoFocus
              className="form-input text-sm"
              placeholder="Örn: Anadolu Tohum A.Ş."
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">E-posta *</label>
            <input
              type="email"
              className="form-input text-sm"
              placeholder="tedarikci@firma.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Telefon</label>
              <input
                className="form-input text-sm"
                placeholder="0532 xxx xx xx"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Kategori</label>
              <input
                className="form-input text-sm"
                placeholder="Tohum, Gübre..."
                value={form.product_category}
                onChange={e => setForm(f => ({ ...f, product_category: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Notlar</label>
            <textarea
              rows={2}
              className="form-input text-sm resize-none"
              placeholder="Ödeme vadesi, anlaşma koşulları..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving || !form.name.trim() || !form.email.trim()} className="flex-1 btn-primary justify-center">
              {saving
                ? <><Loader2 size={14} className="animate-spin" />Kaydediliyor...</>
                : <><Plus size={14} />Ekle</>
              }
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-4">İptal</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch("/api/suppliers")
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setSuppliers)
      .catch(() => toast.error("Tedarikçiler yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number, name: string) => {
    const prevSuppliers = suppliers;
    setSuppliers(prev => prev.filter(s => s.id !== id));
    setConfirmingId(null);
    try {
      const res = await apiFetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast(`${name} tedarikçi listesinden silindi.`);
    } catch {
      setSuppliers(prevSuppliers);
      toast.error("Silme işlemi başarısız. Tekrar deneyin.");
    }
  };

  const thisMonth = suppliers.filter(s => {
    const d = new Date(s.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const categoryCount = new Set(suppliers.map(s => s.product_category).filter(Boolean)).size;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tedarikçi Yönetimi</h1>
            <p className="text-slate-500 text-sm mt-1">
              {loading
                ? "Yükleniyor..."
                : `${suppliers.length} tedarikçi · Kooperatif tedarik rehberi`
              }
            </p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={15} />
            Tedarikçi Ekle
          </button>
        </div>

        {/* Stats */}
        {!loading && suppliers.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Toplam Tedarikçi", value: suppliers.length, icon: Users, color: "text-brand-600 bg-brand-50" },
              { label: "Kategori", value: categoryCount, icon: Tag, color: "text-amber-600 bg-amber-50" },
              { label: "Bu Ay Eklenen", value: thisMonth, icon: CalendarPlus, color: "text-gsuccess-600 bg-gsuccess-50" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card p-4 flex items-center gap-3">
                <div className={clsx("p-2 rounded-lg flex-shrink-0", color)}>
                  <Icon size={16} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <SupplierSkeleton />
        ) : suppliers.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Users size={28} strokeWidth={1.5} className="text-slate-300" />
            </div>
            <p className="text-base font-medium text-slate-500 mb-1">Henüz tedarikçi eklenmemiş</p>
            <p className="text-sm text-slate-400 mb-6 text-center max-w-xs">
              Tedarikçilerinizi ekleyerek AI analiz sonrası otomatik e-posta entegrasyonunu etkinleştirin
            </p>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus size={15} />
              İlk Tedarikçiyi Ekle
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <h2 className="section-title">Tedarikçi Rehberi</h2>
              <span className="text-xs text-slate-400">{suppliers.length} tedarikçi</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Firma</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-posta</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Telefon</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Kategori</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Notlar</th>
                    <th className="w-28" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {suppliers.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-brand-700">
                              {s.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-slate-800">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <a
                          href={`mailto:${s.email}`}
                          className="flex items-center gap-1.5 text-brand-600 hover:text-brand-800 transition-colors"
                        >
                          <Mail size={12} />
                          <span className="text-xs">{s.email}</span>
                        </a>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell text-slate-500 text-xs">
                        {s.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone size={11} />
                            {s.phone}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {s.product_category ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                            <Tag size={10} />
                            {s.product_category}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell text-slate-400 text-xs max-w-[200px] truncate">
                        {s.notes ?? "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {confirmingId === s.id ? (
                            <>
                              <button
                                onClick={() => handleDelete(s.id, s.name)}
                                className="text-xs px-2.5 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold transition-colors shadow-sm"
                              >
                                Sil
                              </button>
                              <button
                                onClick={() => setConfirmingId(null)}
                                className="text-xs px-2.5 py-1 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                              >
                                İptal
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmingId(s.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Tedarikçiyi sil"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <SupplierModal
          onClose={() => setShowModal(false)}
          onSaved={s => setSuppliers(prev => [s, ...prev])}
        />
      )}
    </div>
  );
}
