"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TrendItem {
  product_id: number;
  product_name: string;
  unit: string;
  days_to_empty: number | null;
  daily_avg_consumption: number;
  stock_ratio: number;
  is_critical: boolean;
}

export interface DailyProduct {
  product_id: number;
  name: string;
  unit: string;
  is_critical: boolean;
  daily_avg: number;
  daily: { label: string; in: number; out: number }[];
}

// ── Colour helpers ──────────────────────────────────────────────────────────

function urgencyColor(days: number) {
  if (days <= 3) return "#d62d20";
  if (days <= 7) return "#ffa700";
  return "#008744";
}

// ── Chart 1 : Days-to-Empty ─────────────────────────────────────────────────

interface DaysToEmptyProps {
  trends: TrendItem[];
}

export function DaysToEmptyChart({ trends }: DaysToEmptyProps) {
  const data = trends
    .filter(t => t.days_to_empty != null && t.days_to_empty > 0)
    .slice(0, 8)
    .map(t => ({
      name: t.product_name,
      days: Math.round(t.days_to_empty!),
      fill: urgencyColor(t.days_to_empty!),
    }));

  if (data.length === 0) {
    return (
      <p className="text-xs text-slate-400 text-center py-6">
        Tüketim verisi olmadığı için tahmin yapılamıyor.
      </p>
    );
  }

  const chartHeight = Math.max(data.length * 44 + 50, 160);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          label={{ value: "Gün", position: "insideRight", offset: -4, fontSize: 10, fill: "#94a3b8" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: "#475569" }}
          width={100}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => [`${v} gün`, "Tahmini Stok Ömrü"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Bar dataKey="days" radius={[0, 6, 6, 0]} maxBarSize={24}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Chart 2 : Weekly Flow ───────────────────────────────────────────────────

interface WeeklyFlowProps {
  history: DailyProduct[];
}

export function WeeklyFlowChart({ history }: WeeklyFlowProps) {
  // Aggregate all products into a single daily total
  const days = history[0]?.daily.map(d => d.label) ?? [];

  const aggregated = days.map((label, idx) => {
    const totalIn  = history.reduce((s, p) => s + (p.daily[idx]?.in  ?? 0), 0);
    const totalOut = history.reduce((s, p) => s + (p.daily[idx]?.out ?? 0), 0);
    return { label, in: Math.round(totalIn * 10) / 10, out: Math.round(totalOut * 10) / 10 };
  });

  const hasActivity = aggregated.some(d => d.in > 0 || d.out > 0);

  if (!hasActivity) {
    return (
      <p className="text-xs text-slate-400 text-center py-6">
        Son 7 günde kayıtlı hareket bulunmuyor.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={aggregated} margin={{ left: -16, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
          formatter={(v, name) => [v, name === "in" ? "Giriş" : "Çıkış"]}
        />
        <Legend
          formatter={(v) => (
            <span style={{ fontSize: 11, color: "#64748b" }}>
              {v === "in" ? "Giriş" : "Çıkış"}
            </span>
          )}
        />
        <Bar dataKey="in"  name="in"  fill="#008744" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="out" name="out" fill="#d62d20" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
