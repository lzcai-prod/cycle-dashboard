"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from "recharts";

interface HistEntry {
  date: string;
  stage: number;
  bonds_sig: string;
  bonds_val: number;
  bonds_ma: number;
  equities_sig: string;
  equities_val: number;
  equities_ma: number;
  commodities_sig: string;
  commodities_val: number;
  commodities_ma: number;
}

// Build contiguous segments where signal stays the same
function buildSegments(data: HistEntry[], sigKey: "bonds_sig" | "equities_sig" | "commodities_sig") {
  const segments: { x1: string; x2: string; signal: string }[] = [];
  if (data.length === 0) return segments;

  let start = data[0].date;
  let current = data[0][sigKey];

  for (let i = 1; i < data.length; i++) {
    if (data[i][sigKey] !== current) {
      segments.push({ x1: start, x2: data[i - 1].date, signal: current });
      start = data[i].date;
      current = data[i][sigKey];
    }
  }
  segments.push({ x1: start, x2: data[data.length - 1].date, signal: current });
  return segments;
}

// Stage color mapping
const STAGE_COLORS: Record<number, string> = {
  1: "#3b82f6", // blue
  2: "#10b981", // green
  3: "#22c55e", // bright green
  4: "#f59e0b", // amber
  5: "#ef4444", // red
  6: "#991b1b", // dark red
};

const STAGE_LABELS: Record<number, string> = {
  1: "Late Recession",
  2: "Early Recovery",
  3: "Mid Expansion",
  4: "Late Expansion",
  5: "Early Downturn",
  6: "Full Recession",
};

function StagePanel({ data }: { data: HistEntry[] }) {
  // Build stage segments for colored background
  const segments: { x1: string; x2: string; stage: number }[] = [];
  if (data.length > 0) {
    let start = data[0].date;
    let cur = data[0].stage;
    for (let i = 1; i < data.length; i++) {
      if (data[i].stage !== cur) {
        segments.push({ x1: start, x2: data[i - 1].date, stage: cur });
        start = data[i].date;
        cur = data[i].stage;
      }
    }
    segments.push({ x1: start, x2: data[data.length - 1].date, stage: cur });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-zinc-300">Cycle Stage</span>
        <span className="text-[10px] text-zinc-500">(1=Late Recession ... 6=Full Recession)</span>
      </div>
      <div style={{ width: "100%", height: 100 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
            {segments.map((seg, i) => (
              <ReferenceArea
                key={i}
                x1={seg.x1}
                x2={seg.x2}
                fill={STAGE_COLORS[seg.stage] || "#71717a"}
                fillOpacity={0.15}
              />
            ))}
            <XAxis dataKey="date" hide />
            <YAxis
              domain={[0.5, 6.5]}
              ticks={[1, 2, 3, 4, 5, 6]}
              tick={{ fontSize: 9, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", fontSize: "11px", borderRadius: "8px" }}
              labelStyle={{ color: "#a1a1aa" }}
              formatter={(val: number) => [`Stage ${val}: ${STAGE_LABELS[val] || ""}`, ""]}
            />
            <Area
              type="stepAfter"
              dataKey="stage"
              stroke="#f97316"
              fill="url(#stageGrad)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            <defs>
              <linearGradient id="stageGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
              </linearGradient>
            </defs>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface AssetPanelProps {
  data: HistEntry[];
  label: string;
  subtitle: string;
  valKey: "bonds_val" | "equities_val" | "commodities_val";
  maKey: "bonds_ma" | "equities_ma" | "commodities_ma";
  sigKey: "bonds_sig" | "equities_sig" | "commodities_sig";
  showXAxis?: boolean;
  logScale?: boolean;
  yFormat?: (v: number) => string;
}

function AssetPanel({ data, label, subtitle, valKey, maKey, sigKey, showXAxis, logScale, yFormat }: AssetPanelProps) {
  const segments = useMemo(() => buildSegments(data, sigKey), [data, sigKey]);

  // For log scale: transform values and compute nice tick values
  const { chartData, logTicks, logDomain } = useMemo(() => {
    if (!logScale) return { chartData: data, logTicks: undefined, logDomain: undefined };

    // Find min/max across both val and ma
    let min = Infinity, max = -Infinity;
    for (const d of data) {
      const v = d[valKey] as number;
      const m = d[maKey] as number;
      if (v > 0 && v < min) min = v;
      if (m > 0 && m < min) min = m;
      if (v > max) max = v;
      if (m > max) max = m;
    }

    // Transform to log space
    const transformed = data.map((d) => ({
      ...d,
      [valKey + "_log"]: d[valKey] > 0 ? Math.log10(d[valKey] as number) : 0,
      [maKey + "_log"]: d[maKey] > 0 ? Math.log10(d[maKey] as number) : 0,
    }));

    // Generate nice log ticks (powers of 10 and midpoints)
    const logMin = Math.floor(Math.log10(min));
    const logMax = Math.ceil(Math.log10(max));
    const ticks: number[] = [];
    for (let p = logMin; p <= logMax; p++) {
      ticks.push(p);
      if (p < logMax) ticks.push(p + Math.log10(2));  // midpoint at 2x
      if (p < logMax) ticks.push(p + Math.log10(5));  // midpoint at 5x
    }

    return {
      chartData: transformed,
      logTicks: ticks.filter(t => t >= Math.log10(min * 0.9) && t <= Math.log10(max * 1.1)),
      logDomain: [Math.log10(min * 0.9), Math.log10(max * 1.1)] as [number, number],
    };
  }, [data, logScale, valKey, maKey]);

  const actualValKey = logScale ? valKey + "_log" : valKey;
  const actualMaKey = logScale ? maKey + "_log" : maKey;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-zinc-300">{label}</span>
        <span className="text-[10px] text-zinc-500">{subtitle}</span>
        {logScale && <span className="text-[9px] text-zinc-600 italic">log scale</span>}
      </div>
      <div style={{ width: "100%", height: 120 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
            {segments.map((seg, i) => (
              <ReferenceArea
                key={i}
                x1={seg.x1}
                x2={seg.x2}
                fill={seg.signal === "rising" ? "#10b981" : "#ef4444"}
                fillOpacity={0.08}
              />
            ))}
            <XAxis
              dataKey="date"
              hide={!showXAxis}
              tickFormatter={(val: string) => val.slice(0, 4)}
              minTickGap={50}
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={{ stroke: "#3f3f46" }}
              tickLine={false}
            />
            <YAxis
              domain={logScale ? logDomain : ["auto", "auto"]}
              ticks={logScale ? logTicks : undefined}
              tick={{ fontSize: 9, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={logScale
                ? (v: number) => {
                    const actual = Math.pow(10, v);
                    if (yFormat) return yFormat(actual);
                    return String(Math.round(actual));
                  }
                : (yFormat || ((v: number) => String(v)))
              }
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", fontSize: "11px", borderRadius: "8px" }}
              labelStyle={{ color: "#a1a1aa" }}
              formatter={(val: number, name: string) => {
                const actual = logScale ? Math.pow(10, val) : val;
                return [
                  (yFormat ? yFormat(actual) : actual.toFixed(2)),
                  name.includes("_log") ? (name.includes("ma") ? "200d MA" : "Value") : (name === valKey ? "Value" : "200d MA")
                ];
              }}
            />
            <Line
              type="monotone"
              dataKey={actualValKey}
              stroke="#e4e4e7"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={actualMaKey}
              stroke="#facc15"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function HistoricalChart({ data }: { data: HistEntry[] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
      <div className="mb-4">
        <h2 className="text-xl font-medium text-white">Historical Cycle Stages (Since 2007)</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Weekly backtest &mdash; white line = actual value, dashed = 200d MA.
          Background: <span className="text-emerald-400">green</span> = rising,{" "}
          <span className="text-red-400">red</span> = falling.
        </p>
      </div>

      <div className="space-y-2">
        <StagePanel data={data} />

        <AssetPanel
          data={data}
          label="Bonds"
          subtitle="10Y Yield (inverted: yield above MA = bonds falling)"
          valKey="bonds_val"
          maKey="bonds_ma"
          sigKey="bonds_sig"
          yFormat={(v) => v.toFixed(1) + "%"}
        />

        <AssetPanel
          data={data}
          label="Equities"
          subtitle="S&P 500 (price above MA = rising)"
          valKey="equities_val"
          maKey="equities_ma"
          sigKey="equities_sig"
          logScale
          yFormat={(v) => {
            if (v >= 1000) return (v / 1000).toFixed(1) + "k";
            return String(Math.round(v));
          }}
        />

        <AssetPanel
          data={data}
          label="Commodities"
          subtitle="DJP (price above MA = rising)"
          valKey="commodities_val"
          maKey="commodities_ma"
          sigKey="commodities_sig"
          showXAxis
          logScale
          yFormat={(v) => "$" + v.toFixed(0)}
        />
      </div>

      {/* Stage legend */}
      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: STAGE_COLORS[s], opacity: 0.6 }}
            />
            <span className="text-[10px] text-zinc-400">
              {s}: {STAGE_LABELS[s]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
