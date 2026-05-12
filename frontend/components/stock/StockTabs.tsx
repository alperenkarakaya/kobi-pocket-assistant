import { clsx } from "clsx";
import { Package, BarChart2, History } from "lucide-react";
import type { ActiveTab } from "./types";

const TABS = [
  { key: "products",  label: "Ürünler",           icon: Package  },
  { key: "analytics", label: "Analiz & Metrikler", icon: BarChart2 },
  { key: "history",   label: "Hareket Geçmişi",   icon: History  },
] as const;

interface StockTabsProps {
  activeTab: ActiveTab;
  onChange: (tab: ActiveTab) => void;
}

export default function StockTabs({ activeTab, onChange }: StockTabsProps) {
  return (
    <div className="mb-6 inline-flex items-center bg-slate-100 rounded-xl p-1 gap-1">
      {TABS.map(({ key, label, icon: Icon }) => {
        const active = activeTab === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={clsx(
              "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 select-none",
              active
                ? "bg-white text-slate-900 shadow-sm shadow-slate-200/80 font-semibold"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Icon
              size={14}
              strokeWidth={active ? 2.2 : 1.8}
              className={active ? "text-brand-600" : ""}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}
