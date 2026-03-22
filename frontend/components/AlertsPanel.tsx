"use client";

import type { ThresholdAlert, SeriesFile } from "@/lib/types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface Props {
  alerts: Record<string, ThresholdAlert>;
  series: Record<string, SeriesFile>;
}

// Map alert keys to series file keys
const ALERT_SERIES_MAP: Record<string, string> = {
  yield_curve_inversion: "yield_curve",
  credit_spread: "credit_spread",
  vix: "vix",
  sahm_rule: "sahm_rule",
  oil_yoy: "oil_wti",
};

// Threshold reference lines per indicator
const REFERENCE_LINES: Record<string, { value: number; label: string; color: string }[]> = {
  yield_curve_inversion: [
    { value: 0, label: "Inversion", color: "#ef4444" },
  ],
  credit_spread: [
    { value: 5, label: "Stress (500bps)", color: "#eab308" },
    { value: 8, label: "Crisis (800bps)", color: "#ef4444" },
  ],
  vix: [
    { value: 25, label: "Elevated", color: "#eab308" },
    { value: 30, label: "High Fear", color: "#f97316" },
    { value: 40, label: "Panic", color: "#ef4444" },
  ],
  sahm_rule: [
    { value: 0.5, label: "Recession Trigger", color: "#ef4444" },
  ],
  oil_yoy: [],
};

// Interpretation descriptions for each alert
const INTERPRETATIONS: Record<string, string> = {
  yield_curve_inversion: "When the 10Y-2Y spread goes negative, it has preceded every US recession since the 1970s.",
  credit_spread: "Measures corporate bond risk premium. Widening above 500bps signals financial stress.",
  vix: "Market fear gauge. Sustained readings above 25 indicate elevated uncertainty.",
  sahm_rule: "Triggers at 0.50 when unemployment rises sharply. Has a perfect recession track record.",
  oil_yoy: "Rapid oil price doublings have preceded most post-war recessions (Hamilton, 1983).",
};

function isTriggered(alert: ThresholdAlert): boolean {
  return !!(alert.triggered || alert.level_triggered || alert.widening_triggered);
}

function getSignalInfo(alert: ThresholdAlert): { label: string; isNegative: boolean } {
  const triggered = isTriggered(alert);
  const interp = (alert.interpretation || "").toLowerCase();
  const isNeg = triggered || interp.includes("elevated") || interp.includes("warning");
  return {
    label: alert.interpretation || (triggered ? "TRIGGERED" : "normal"),
    isNegative: isNeg,
  };
}

interface MiniChartProps {
  seriesData: SeriesFile;
  alertKey: string;
  color: string;
}

function MiniChart({ seriesData, alertKey, color }: MiniChartProps) {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
  const cutoffStr = cutoffDate.toISOString().split("T")[0];

  const chartData = seriesData.data
    .filter((d) => d[0] >= cutoffStr)
    .map(([date, value]) => ({ date, value }));
  const refLines = REFERENCE_LINES[alertKey] || [];

  return (
    <div style={{ width: "100%", height: 100, marginTop: 8 }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`grad-${alertKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => {
              const parts = d.split("-");
              return `${parts[1]}/${parts[0].slice(2)}`;
            }}
            minTickGap={40}
            tick={{ fontSize: 9, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 9, fill: "#71717a" }}
            width={35}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#1a1d2e",
              border: "1px solid #2a2d3e",
              borderRadius: 6,
              fontSize: 11,
              padding: "4px 8px",
            }}
            labelStyle={{ color: "#a1a1aa", fontSize: 10 }}
            formatter={(value: number) => [value.toFixed(2), ""]}
          />
          {refLines.map((ref) => (
            <ReferenceLine
              key={ref.label}
              y={ref.value}
              stroke={ref.color}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: ref.label,
                position: "right",
                fill: ref.color,
                fontSize: 9,
              }}
            />
          ))}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={`url(#grad-${alertKey})`}
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AlertsPanel({ alerts, series }: Props) {
  const entries = Object.entries(alerts);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
      <h2 className="text-xl font-medium text-white mb-4">
        Supporting Indicators &amp; Thresholds
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map(([key, alert]) => {
          const { label, isNegative } = getSignalInfo(alert);
          const color = isNegative ? "#ef4444" : "#10b981";
          const badgeClass = isNegative ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400";
          const val = alert.value ?? alert.current_price ?? "N/A";
          const seriesKey = ALERT_SERIES_MAP[key];
          const seriesData = seriesKey ? series[seriesKey] : undefined;
          const description = INTERPRETATIONS[key] || "";

          return (
            <a
              key={key}
              href={alert.source}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 transition-colors group"
            >
              <div className="text-xs text-zinc-400 mb-1 font-medium">
                {alert.name}
              </div>

              <div className="flex items-end gap-2 mb-2">
                <span className="text-2xl font-semibold text-zinc-100">
                  {typeof val === "number" ? val.toFixed(2) : val}
                </span>
              </div>

              <div className="mb-2 flex items-center justify-between">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                  {label}
                </span>
                <span className="text-[10px] text-zinc-500 group-hover:text-blue-400 transition-colors">
                  View source data →
                </span>
              </div>

              {description && (
                <p className="text-xs text-zinc-500 leading-snug mb-1">
                  {description}
                </p>
              )}

              {seriesData && (
                <MiniChart seriesData={seriesData} alertKey={key} color={color} />
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
