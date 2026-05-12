import type { DailyProduct } from "@/components/ui/StockCharts";

export interface Supplier {
  id: number;
  name: string;
  email: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  unit: string;
  threshold: number;
  current_stock: number;
  is_below_threshold: boolean;
  daily_consumption?: number;
  days_to_empty?: number | null;
  supplier_id: number | null;
  supplier: Supplier | null;
}

export interface TrendItem {
  product_id: number;
  product_name: string;
  unit: string;
  current_stock: number;
  threshold: number;
  stock_ratio: number;
  is_critical: boolean;
  daily_avg_consumption: number;
  days_to_empty: number | null;
  total_in_7d: number;
  total_out_7d: number;
  movement_count_7d: number;
}

export type AnalyticsHistory = DailyProduct[];
export type ActiveTab = "products" | "analytics" | "history";
export type Modal = "new-product" | "add-stock" | "remove-stock" | "delete" | null;

export interface StockMovementRow {
  id: number;
  timestamp: string;
  product_id: number;
  product_name: string;
  product_sku: string;
  unit: string;
  quantity: number;
  type: string;
  source: string;
  notes: string | null;
}
