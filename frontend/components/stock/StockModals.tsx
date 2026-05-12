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
    <ModalShell title="Yeni Ürün Ekle" icon={PackagePlus} iconClass="bg-brand-50 text-brand-600" onClose={onCancel}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Ürün Adı</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="örn. Buğday" className="form-input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">SKU (Stok Kodu)</label>
          <input value={sku} onChange={e => setSku(e.target.value)} placeholder="örn. WHEAT-001" className="form-input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Birim</label>
            <select value={unit} onChange={e => setUnit(e.target.value)} className="form-input">
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Kritik Eşik</label>
            <input type="number" min="0" step="0.1" value={threshold} onChange={e => setThreshold(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0" className="form-input" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tedarikçi (opsiyonel)</label>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="form-input">
            <option value="">— Secilmedi —</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Başlangıç Stoğu (opsiyonel)</label>
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
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center">İptal</button>
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
            Oluştur
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function DeleteModal({ product, onCancel, onConfirm }: { product: Product; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ModalShell title="Ürünü Sil" icon={Trash2} iconClass="bg-red-50 text-red-600" onClose={onCancel}>
      <p className="text-sm text-slate-600 mb-1">
        <span className="font-semibold text-slate-800">{product.name}</span> ürünü ve tüm stok hareketleri kalıcı olarak silinecek.
      </p>
      <p className="text-xs text-slate-400 mb-5">Bu işlem geri alınamaz.</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">İptal</button>
        <button onClick={onConfirm} className="btn-danger flex-1 justify-center">Kalıcı Sil</button>
      </div>
    </ModalShell>
  );
}

export function AddStockModal({ product, onCancel, onConfirm }: { product: Product; onCancel: () => void; onConfirm: (qty: number) => void }) {
  const [qty, setQty] = useState<number | "">(1);

  return (
    <ModalShell title="Stok Ekle" icon={Plus} iconClass="bg-brand-50 text-brand-600" onClose={onCancel}>
      <p className="text-sm text-slate-600 mb-4">
        <span className="font-semibold text-brand-700">{product.name}</span> için eklenecek miktarı girin.
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
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">İptal</button>
        <button disabled={!qty || Number(qty) <= 0} onClick={() => onConfirm(Number(qty))} className="btn-primary flex-1 justify-center">Ekle</button>
      </div>
    </ModalShell>
  );
}

export function RemoveStockModal({ product, onCancel, onConfirm }: { product: Product; onCancel: () => void; onConfirm: (qty: number) => void }) {
  const [qty, setQty] = useState<number | "">(1);

  const amount = qty === "" ? 0 : Number(qty);
  const remaining = product.current_stock - amount;
  const overstock = amount > product.current_stock;
  const willBeCritical = !overstock && product.threshold > 0 && remaining < product.threshold;
  const valid = amount > 0 && !overstock;

  return (
    <ModalShell title="Stok Azalt" icon={AlertTriangle} iconClass="bg-amber-50 text-amber-600" onClose={onCancel}>
      <p className="text-sm text-slate-600 mb-1">
        <span className="font-semibold text-slate-800">{product.name}</span> stoğundan miktar düşecek.
      </p>
      <p className="text-xs text-amber-600 font-medium mb-4">Bu işlem 30 saniye içinde geri alınabilir.</p>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Azaltılacak miktar ({product.unit})</label>
        <input
          autoFocus
          type="number"
          min="0.1"
          max={product.current_stock}
          step="0.1"
          value={qty}
          onChange={e => setQty(e.target.value === "" ? "" : parseFloat(e.target.value))}
          onKeyDown={e => e.key === "Enter" && valid && onConfirm(amount)}
          className={`form-input ${overstock ? "border-red-400 focus:ring-red-500" : "border-amber-300 focus:ring-amber-500"}`}
        />
        {overstock && (
          <p className="text-xs text-red-600 mt-1.5 font-medium">Mevcut stok ({product.current_stock} {product.unit}) aşılamaz.</p>
        )}
      </div>

      {/* Remaining stock preview */}
      <div className={`rounded-lg px-4 py-3 mb-5 text-sm ${willBeCritical ? "bg-red-50 border border-red-200" : "bg-slate-50 border border-slate-200"}`}>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 text-xs">Mevcut</span>
          <span className="font-semibold text-slate-700">{product.current_stock.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} {product.unit}</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-slate-500 text-xs">İşlem sonrası</span>
          <span className={`font-bold text-base ${overstock ? "text-red-500" : willBeCritical ? "text-red-600" : "text-slate-800"}`}>
            {overstock ? "—" : `${Math.max(remaining, 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ${product.unit}`}
          </span>
        </div>
        {product.threshold > 0 && (
          <div className="flex justify-between items-center mt-1">
            <span className="text-slate-400 text-xs">Kritik eşik</span>
            <span className="text-slate-400 text-xs">{product.threshold.toLocaleString("tr-TR")} {product.unit}</span>
          </div>
        )}
        {willBeCritical && (
          <p className="text-xs text-red-600 font-semibold mt-2">⚠️ Bu işlem stoğu kritik seviyenin altına düşürecek.</p>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1 justify-center">İptal</button>
        <button
          disabled={!valid}
          onClick={() => onConfirm(amount)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Azalt
        </button>
      </div>
    </ModalShell>
  );
}
