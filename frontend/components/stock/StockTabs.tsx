import { clsx } from "clsx";
import type { ActiveTab } from "./types";

interface StockTabsProps {
  activeTab: ActiveTab;
  onChange: (tab: ActiveTab) => void;
}

export default function StockTabs({ activeTab, onChange }: StockTabsProps) {
  return (
    <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1">
      {[
        { key: "products", label: "Ürünler" },
        { key: "analytics", label: "Analiz & Metrikler" },
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key as ActiveTab)}
          className={clsx(
            "px-4 py-2 text-sm rounded-md transition-colors",
            activeTab === tab.key
              ? "bg-brand-500 text-white font-semibold"
              : "text-slate-600 hover:bg-slate-50"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
