"use client";

import type { Barometer, SeriesFile } from "@/lib/types";
import { computeMA } from "@/lib/data";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface Props {
  barometer: Barometer;
  series?: SeriesFile;
  label: string;
}

export default function BarometerCard({ barometer, series, label }: Props) {
  const isRising = barometer.signal === "rising";
  const signalColor = isRising ? "var(--accent-green)" : "var(--accent-red)";
  const arrow = isRising ? "↑" : "↓";

  // Prepare chart data (last 2 years for visibility)
  let chartData: { date: string; value: number; ma: number | null }[] = [];
  if (series) {
    const recent = series.data.slice(-500);
    const maData = computeMA(recent, 200);
    chartData = recent.map((point, i) => ({
      date: point[0],
      value: point[1],
      ma: maData[i]?.[1] ?? null,
    }));
  }

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", borderLeft: `4px solid ${signalColor}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{label}</div>
        <div className="text-lg font-bold" style={{ color: signalColor }}>
          {arrow} {barometer.signal.toUpperCase()}
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>Current</div>
          <div className="text-sm font-mono font-semibold">{barometer.current?.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>200d MA</div>
          <div className="text-sm font-mono font-semibold">{barometer.ma_200d?.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>% from MA</div>
          <div className="text-sm font-mono font-semibold" style={{ color: signalColor }}>
            {barometer.pct_from_ma > 0 ? "+" : ""}{barometer.pct_from_ma?.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Inversion note */}
      {barometer.inversion && (
        <div className="text-xs mb-3 px-2 py-1 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-muted)" }}>
          ⚠ {barometer.inversion_reason}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => {
                  const parts = d.split("-");
                  return `${parts[1]}/${parts[0].slice(2)}`;
                }}
                minTickGap={40}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 10 }}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--text-secondary)" }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={signalColor}
                fill={`${signalColor}15`}
                strokeWidth={1.5}
                dot={false}
                name={series?.name || "Value"}
              />
              <Line
                type="monotone"
                dataKey="ma"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                name="200d MA"
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Signal change date */}
      {barometer.signal_changed_date && (
        <div className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Signal changed: {barometer.signal_changed_date}
        </div>
      )}

      {/* Source link */}
      <div className="text-xs mt-1">
        <a href={series?.source || "#"} target="_blank" rel="noopener noreferrer"
          style={{ color: "var(--accent-blue)" }}>
          View source data →
        </a>
      </div>
    </div>
  );
}
