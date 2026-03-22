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
  oil_yoy: [], // no fixed threshold line — oil uses YoY change
};

function isTriggered(alert: ThresholdAlert): boolean {
  return !!(alert.triggered || alert.level_triggered || alert.widening_triggered);
}

function getAlertColor(alert: ThresholdAlert): string {
  if (isTriggered(alert)) return "var(--accent-red)";
  const interp = (alert.interpretation || "").toLowerCase();
  if (interp.includes("elevated") || interp.includes("warning")) return "var(--accent-yellow)";
  return "var(--accent-green)";
}

interface MiniChartProps {
  seriesData: SeriesFile;
  alertKey: string;
  color: string;
}

function MiniChart({ seriesData, alertKey, color }: MiniChartProps) {
  // Use last 2 years of data for mini charts
  const recent = seriesData.data.slice(-500);
  const chartData = recent.map(([date, value]) => ({ date, value }));
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
    <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-card)" }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        Supporting Indicators & Thresholds
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map(([key, alert]) => {
          const color = getAlertColor(alert);
          const val = alert.value ?? alert.current_price ?? "N/A";
          const seriesKey = ALERT_SERIES_MAP[key];
          const seriesData = seriesKey ? series[seriesKey] : undefined;

          return (
            <div
              key={key}
              className="rounded-lg p-3"
              style={{ background: "var(--bg-primary)", borderLeft: `3px solid ${color}` }}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {alert.name}
                </div>
                <div className="text-xs px-2 py-0.5 rounded" style={{ background: `${color}20`, color }}>
                  {isTriggered(alert) ? "TRIGGERED" : (alert.interpretation || "normal")}
                </div>
              </div>
              <div className="text-xl font-mono font-bold mt-1" style={{ color }}>
                {typeof val === "number" ? val.toFixed(2) : val}
              </div>

              {/* Mini chart */}
              {seriesData && (
                <MiniChart seriesData={seriesData} alertKey={key} color={color} />
              )}

              <a
                href={alert.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs mt-1 inline-block"
                style={{ color: "var(--accent-blue)" }}
              >
                FRED →
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
