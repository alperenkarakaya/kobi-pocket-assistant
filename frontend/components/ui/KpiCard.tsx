import { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

interface KpiCardProps {
  label: string;
  value: number | string;
  unit?: string;
  alert?: boolean;
  Icon: LucideIcon;
  subtext?: string;
}

const ALERT_STYLES = {
  icon: "bg-red-50 text-red-600",
  value: "text-red-600",
  border: "border-red-100",
  dot: "bg-red-500",
};

const NORMAL_STYLES = {
  icon: "bg-brand-50 text-brand-600",
  value: "text-slate-900",
  border: "border-slate-200",
  dot: "bg-brand-500",
};

export default function KpiCard({ label, value, unit, alert, Icon, subtext }: KpiCardProps) {
  const s = alert ? ALERT_STYLES : NORMAL_STYLES;

  return (
    <div className={clsx(
      "bg-white rounded-xl border shadow-card p-5 relative overflow-hidden transition-shadow duration-200 hover:shadow-card-md",
      s.border
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={clsx("inline-flex p-2 rounded-lg", s.icon)}>
          <Icon size={18} strokeWidth={2} />
        </div>
        {alert && (
          <span className="flex h-2 w-2 mt-1">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75" />
            <span className={clsx("relative inline-flex rounded-full h-2 w-2", s.dot)} />
          </span>
        )}
      </div>

      <div className="flex items-end gap-1.5 mb-0.5">
        <span className={clsx("text-3xl font-bold tracking-tight", s.value)}>
          {value}
        </span>
        {unit && (
          <span className="text-sm text-slate-400 mb-1 font-medium">{unit}</span>
        )}
      </div>

      <p className="text-sm text-slate-500 font-medium">{label}</p>
      {subtext && <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>}

      {/* Decorative corner */}
      <div className={clsx(
        "absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-[0.04]",
        alert ? "bg-red-500" : "bg-brand-500"
      )} />
    </div>
  );
}
