import { useState } from "react";
import { clsx } from "clsx";
import { Plus, Trash2, AlertTriangle, PackagePlus, X } from "lucide-react";
import type { Product, Supplier } from "./types";

interface ModalShellProps {
  title: string;
  icon: React.ElementType;
  iconClass: string;
  children: React.ReactNode;
  onClose: () => void;
}

function Overlay({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />;
}

function ModalShell({ title, icon: Icon, iconClass, children, onClose }: ModalShellProps) {
  return (
    <>
      <Overlay onClose={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl border border-slate-200 shadow-card-lg p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className={clsx("p-1.5 rounded-lg", iconClass)}>
                <Icon size={16} />
              </div>
              <h2 className="text-slate-900 font-semibold">{title}</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

const UNITS = ["kg", "ton", "liter", "adet", "cuval", "kutu", "unit"];

export function NewProductModal({
  suppliers,
  onCancel,
  onConfirm,
}: {
  suppliers: Supplier[];
  onCancel: () => void;
  onConfirm: (data: { name: string; sku: string; unit: string; threshold: number; supplier_id?: number; initial_stock?: number }) => void;
}) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("kg");
  const [threshold, setThreshold] = useState<number | "">(0);
  const [initialStock, setInitialStock] = useState<number | "">("");
  const [supplierId, setSupplierId] = useState<string>("");
  const valid = name.trim() && sku.trim() && Number(threshold) >= 0 && (initialStock === "" || Number(initialStock) >= 0);

  return (
    <ModalShell title="Yeni Urun Ekle" icon={PackagePlus} iconClass="bg-brand-50 text-brand-600" onClose={onCancel}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Urun Adi</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="orn. Bugday" className="form-input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">SKU (Stok Kodu)</label>
          <input value={sku} onChange={e => setSku(e.target.value)} placeholder="orn. WHEAT-001" className="form-input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Birim</label>
            <select value={unit} onChange={e => setUnit(e.target.value)} className="form-input">
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Kritik Esik</label>
            <input type="number" min="0" step="0.1" value={threshold} onChange={e => setThreshold(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0" className="form-input" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tedarikci (opsiyonel)</label>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="form-input">
            <option value="">— Secilmedi —</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Baslangic Stogu (opsiyonel)</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={initialStock}
            onChange={e => setInitialStock(e.target.value === "" ? "" : parseFloat(e.target.value))}
            placeholder="Boş bırakılırsa 0"
            className="form-input"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Iptal</button>
          <button
            disabled={!valid}
            onClick={() => valid && onConfirm({
              name: name.trim(),
              sku: sku.trim().toUpperCase(),
              unit,
              threshold: Number(threshold),
              supplier_id: supplierId ? Number(supplierId) : undefined,
              initial_stock: initialStock === "" ? undefined : Number(initialStock),
            })}
            className="btn-primary flex-1 justify-center"
          >
            Olustur
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function DeleteModal({ product, onCancel, onConfirm }: { product: Product; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ModalShell title="Urunu Sil" icon={Trash2} iconClass="bg-red-50 text-red-600" onClose={onCancel}>
      <p className="text-sm text-slate-600 mb-1">
        <span className="font-semibold text-slate-800">{product.name}</span> urunu ve tum stok hareketleri kalici olarak silinecek.
      </p>
      <p className="text-xs text-slate-400 mb-5">Bu islem geri alinamaz.</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Iptal</button>
        <button onClick={onConfirm} className="btn-danger flex-1 justify-center">Kalici Sil</button>
      </div>
    </ModalShell>
  );
}

export function AddStockModal({ product, onCancel, onConfirm }: { product: Product; onCancel: () => void; onConfirm: (qty: number) => void }) {
  const [qty, setQty] = useState<number | "">(1);

  return (
    <ModalShell title="Stok Ekle" icon={Plus} iconClass="bg-brand-50 text-brand-600" onClose={onCancel}>
      <p className="text-sm text-slate-600 mb-4">
        <span className="font-semibold text-brand-700">{product.name}</span> icin eklenecek miktari girin.
      </p>
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Miktar ({product.unit})</label>
        <input
          autoFocus
          type="number"
          min="0.1"
          step="0.1"
          value={qty}
          onChange={e => setQty(e.target.value === "" ? "" : parseFloat(e.target.value))}
          onKeyDown={e => e.key === "Enter" && qty && Number(qty) > 0 && onConfirm(Number(qty))}
          className="form-input"
        />
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Iptal</button>
        <button disabled={!qty || Number(qty) <= 0} onClick={() => onConfirm(Number(qty))} className="btn-primary flex-1 justify-center">Ekle</button>
      </div>
    </ModalShell>
  );
}

export function RemoveStockModal({ product, onCancel, onConfirm }: { product: Product; onCancel: () => void; onConfirm: (qty: number) => void }) {
  const [qty, setQty] = useState<number | "">(1);

  return (
    <ModalShell title="Stok Azalt" icon={AlertTriangle} iconClass="bg-amber-50 text-amber-600" onClose={onCancel}>
      <p className="text-sm text-slate-600 mb-1">
        <span className="font-semibold text-slate-800">{product.name}</span> stogundan miktar dusecek.
      </p>
      <p className="text-xs text-amber-600 font-medium mb-1">Bu islem 30 saniye icinde geri alinabilir.</p>
      <p className="text-xs text-slate-400 mb-4">Mevcut stok: {product.current_stock} {product.unit}</p>
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Azaltilacak miktar ({product.unit})</label>
        <input
          autoFocus
          type="number"
          min="0.1"
          max={product.current_stock}
          step="0.1"
          value={qty}
          onChange={e => setQty(e.target.value === "" ? "" : parseFloat(e.target.value))}
          onKeyDown={e => e.key === "Enter" && qty && Number(qty) > 0 && onConfirm(Number(qty))}
          className="form-input border-amber-300 focus:ring-amber-500"
        />
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Iptal</button>
        <button
          disabled={!qty || Number(qty) <= 0}
          onClick={() => onConfirm(Number(qty))}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          Azalt
        </button>
      </div>
    </ModalShell>
  );
}
