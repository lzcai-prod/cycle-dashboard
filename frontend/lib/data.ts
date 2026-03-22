import type { Indicators, SeriesFile, HistoryEntry } from "./types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export async function fetchIndicators(): Promise<Indicators> {
  const res = await fetch(`${BASE}/data/indicators.json`);
  return res.json();
}

export async function fetchSeries(name: string): Promise<SeriesFile> {
  const res = await fetch(`${BASE}/data/series/${name}.json`);
  return res.json();
}

export async function fetchHistory(): Promise<HistoryEntry[]> {
  const res = await fetch(`${BASE}/data/history.json`);
  return res.json();
}

export async function fetchAllSeries(): Promise<Record<string, SeriesFile>> {
  const names = [
    "treasury_10y", "sp500", "commodity_djp",
    "yield_curve", "credit_spread", "vix",
    "sahm_rule", "oil_wti",
    "discount_rate", "m2_money", "jobless_claims", "capacity_util", "commercial_paper"
  ];
  const results: Record<string, SeriesFile> = {};
  await Promise.all(
    names.map(async (name) => {
      try {
        results[name] = await fetchSeries(name);
      } catch {
        console.warn(`Failed to load series: ${name}`);
      }
    })
  );
  return results;
}

/**
 * Compute moving average from raw series data.
 * Returns array of [date, ma_value] pairs.
 */
export function computeMA(data: [string, number][], window: number): [string, number | null][] {
  return data.map((point, i) => {
    if (i < window - 1) return [point[0], null];
    const slice = data.slice(i - window + 1, i + 1);
    const avg = slice.reduce((sum, p) => sum + p[1], 0) / slice.length;
    return [point[0], Math.round(avg * 10000) / 10000];
  });
}
