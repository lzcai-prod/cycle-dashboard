"use client";

import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function HistoricalChart({ data }: { data: any[] }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((d) => ({
      date: d.date,
      stage: d.stage,
      bonds: d.bonds === "rising" ? 1 : 0,
      equities: d.equities === "rising" ? 1 : 0,
      commodities: d.commodities === "rising" ? 1 : 0,
    }));
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
      <div className="mb-4">
        <h2 className="text-xl font-medium text-white">Historical Cycle Stages (Since 2007)</h2>
        <p className="text-sm text-zinc-400 mt-1">Weekly backtest of Pring&apos;s Stage model</p>
      </div>

      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorStage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
            <XAxis
              dataKey="date"
              tickFormatter={(val: string) => val.slice(0, 4)}
              minTickGap={50}
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={{ stroke: "#3f3f46" }}
              tickLine={false}
            />
            <YAxis
              domain={[1, 6]}
              tickCount={6}
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", fontSize: "12px", borderRadius: "8px" }}
              itemStyle={{ color: "#f4f4f5" }}
              labelStyle={{ color: "#a1a1aa", marginBottom: "4px" }}
              formatter={(val: number) => [`Stage ${val}`, "Stage"]}
            />
            <Area
              type="stepAfter"
              dataKey="stage"
              stroke="#f97316"
              fill="url(#colorStage)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="text-xs text-center p-2 rounded bg-zinc-800/50 text-zinc-400">
          <div className="font-semibold text-zinc-300 mb-1">Bonds</div>
          <div className="w-full h-1 bg-zinc-700 rounded-full overflow-hidden flex">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1" style={{ backgroundColor: d.bonds ? "#10b981" : "#ef4444" }} />
            ))}
          </div>
        </div>
        <div className="text-xs text-center p-2 rounded bg-zinc-800/50 text-zinc-400">
          <div className="font-semibold text-zinc-300 mb-1">Equities</div>
          <div className="w-full h-1 bg-zinc-700 rounded-full overflow-hidden flex">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1" style={{ backgroundColor: d.equities ? "#10b981" : "#ef4444" }} />
            ))}
          </div>
        </div>
        <div className="text-xs text-center p-2 rounded bg-zinc-800/50 text-zinc-400">
          <div className="font-semibold text-zinc-300 mb-1">Commodities</div>
          <div className="w-full h-1 bg-zinc-700 rounded-full overflow-hidden flex">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1" style={{ backgroundColor: d.commodities ? "#10b981" : "#ef4444" }} />
            ))}
          </div>
        </div>
      </div>
      <div className="text-[10px] text-zinc-500 text-center mt-2">
        Green = Rising (Price &gt; 200d MA), Red = Falling
      </div>
    </div>
  );
}
