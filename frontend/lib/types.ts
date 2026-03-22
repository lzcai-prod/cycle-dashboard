// Raw series data from data/series/*.json
export interface SeriesFile {
  name: string;
  unit: string;
  frequency: string;
  source: string;
  updated: string;
  count: number;
  data: [string, number][]; // [date, value]
}

// Barometer from indicators.json
export interface Barometer {
  name: string;
  status: string;
  current: number;
  current_date: string;
  ma_200d: number;
  pct_from_ma: number;
  above_ma: boolean;
  inversion: boolean;
  inversion_reason: string | null;
  signal: "rising" | "falling" | "unknown";
  signal_changed_date: string | null;
}

// Stage info
export interface StageInfo {
  stage: number | null;
  label: string;
  bonds: string;
  equities: string;
  commodities: string;
}

// Allocation guidance
export interface Allocation {
  bonds: string;
  equities: string;
  commodities: string;
  cash: string;
  rationale: string;
}

// Threshold alert
export interface ThresholdAlert {
  name: string;
  value?: number;
  current_price?: number;
  triggered?: boolean;
  level_triggered?: boolean;
  widening_triggered?: boolean;
  interpretation?: string;
  source: string;
  [key: string]: unknown;
}

// Full indicators.json
export interface Indicators {
  computed_at: string;
  ma_period: { days: number; label: string };
  barometers: {
    bonds: Barometer;
    equities: Barometer;
    commodities: Barometer;
  };
  stage: StageInfo;
  allocation: Allocation;
  threshold_alerts: Record<string, ThresholdAlert>;
  stage_reference: Record<string, { label: string; bonds: string; equities: string; commodities: string }>;
  data_sources: Record<string, string>;
  model_reference: string;
}

// History entry
export interface HistoryEntry {
  date: string;
  stage: number | null;
  label: string;
  bonds: string;
  equities: string;
  commodities: string;
}

// Stage display config
export const STAGE_COLORS: Record<number, string> = {
  1: "#3b82f6", // blue
  2: "#22c55e", // green
  3: "#22c55e", // green
  4: "#eab308", // yellow
  5: "#f97316", // orange
  6: "#ef4444", // red
};

export const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: "Bonds rally as rates fall. Economy bottoming. Cash → Bonds.",
  2: "Sweet spot — bonds + equities both rising. Deploy cash.",
  3: "Full expansion. Commodities join. Bonds weaken.",
  4: "Late cycle. Equities topping. Commodities still strong.",
  5: "Downturn begins. Equities falling. Raise cash.",
  6: "Everything falling. Maximum defensive. Wait for Stage 1.",
};
