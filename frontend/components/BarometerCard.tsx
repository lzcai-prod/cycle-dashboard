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
    // Fetch extra data for MA warm-up, then trim to ~500 visible points
    const extended = series.data.slice(-700);
    const maData = computeMA(extended, 200);
    const fullData = extended.map((point, i) => ({
      date: point[0],
      value: point[1],
      ma: maData[i]?.[1] ?? null,
    }));
    // Trim to last 500 points (MA will be populated from the start)
    chartData = fullData.slice(-500);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-white">{label}</h2>
        <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${isRising ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          {arrow} {barometer.signal.toUpperCase()}
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="bg-zinc-800/50 rounded-lg p-2 border border-zinc-700/50">
          <div className="text-xs text-zinc-400 mb-1">Current</div>
          <div className="text-lg font-mono font-semibold text-zinc-100">{barometer.current?.toFixed(2)}</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2 border border-zinc-700/50">
          <div className="text-xs text-zinc-400 mb-1">200d MA</div>
          <div className="text-lg font-mono font-semibold text-zinc-100">{barometer.ma_200d?.toFixed(2)}</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2 border border-zinc-700/50">
          <div className="text-xs text-zinc-400 mb-1">% Diff</div>
          <div className={`text-lg font-mono font-semibold ${isRising ? "text-emerald-400" : "text-red-400"}`}>
            {barometer.pct_from_ma > 0 ? "+" : ""}{barometer.pct_from_ma?.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Inversion note */}
      {barometer.inversion && (
        <div className="text-xs mb-4 px-3 py-2 rounded-lg bg-zinc-800/50 text-zinc-400 border border-zinc-700/50">
          <span className="text-amber-500 font-bold mr-1">⚠</span> {barometer.inversion_reason}
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
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isRising ? "#10b981" : "#ef4444"}
                fill={isRising ? "#10b98115" : "#ef444415"}
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
