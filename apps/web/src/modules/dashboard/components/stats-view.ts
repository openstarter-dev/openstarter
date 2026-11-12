export interface DashboardTrendPoint {
  consumed: number;
  date: string;
  granted: number;
}

export interface DashboardSpendTotal {
  currency: string;
  total: number;
}

export interface DashboardStats {
  activeApiKeys: number;
  balance: number;
  creditsConsumed30d: number;
  creditsGranted30d: number;
  ordersCount: number;
  paidOrdersCount: number;
  spendTotal: DashboardSpendTotal | null;
  trend: DashboardTrendPoint[];
}
