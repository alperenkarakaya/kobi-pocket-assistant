import { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

interface KpiCardProps {
  label: string;
  value: number | string;
  unit?: string;
  alert?: boolean;
  Icon: LucideIcon;
}

export default function KpiCard({ label, value, unit, alert, Icon }: KpiCardProps) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-xl p-6 border transition-all duration-200 scanline",
        alert
          ? "card-glow-alert bg-[#1a1010] border-red-500/20"
          : "card-glow bg-[#111a14] border-[rgba(34,197,94,0.08)]"
      )}
    >
      {/* Icon badge */}
      <div
        className={clsx(
          "inline-flex p-2.5 rounded-lg mb-4",
          alert
            ? "bg-red-500/10 text-red-400"
            : "bg-brand-500/10 text-brand-400"
        )}
      >
        <Icon size={18} strokeWidth={1.8} />
      </div>

      {/* Value */}
      <div className="flex items-end gap-1.5 mb-1">
        <span
          className={clsx(
            "text-3xl font-bold tracking-tight",
            alert ? "text-red-400" : "text-white"
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm text-slate-500 mb-0.5">{unit}</span>
        )}
      </div>

      {/* Label */}
      <p className="text-sm text-slate-400">{label}</p>

      {/* Alert pulse dot */}
      {alert && (
        <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
      )}

      {/* Corner accent */}
      <div
        className={clsx(
          "absolute bottom-0 right-0 w-16 h-16 rounded-tl-full opacity-5",
          alert ? "bg-red-500" : "bg-brand-400"
        )}
      />
    </div>
  );
}
