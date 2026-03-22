"use client";

import { Info } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from "recharts";

export function MacroIndicatorsPanel({ indicators, series }: { indicators: any, series: any }) {
  if (!indicators || !indicators.macro_indicators) return null;

  const macro = indicators.macro_indicators;
  const entries = Object.entries(macro) as [string, any][];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-medium text-white">Pring&apos;s Macro Indicators</h2>
        <div className="group relative">
          <Info className="h-4 w-4 text-zinc-500 cursor-help" />
          <div className="absolute left-0 bottom-6 w-64 rounded-md bg-zinc-800 p-3 text-xs text-zinc-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            These are the actual underlying economic components Martin Pring uses to build his proprietary Barometer models, tracking liquidity, labor, and capacity.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map(([key, item], idx) => {
          
          let displayValue = "";
          let suffix = "";
          if (key === "m2_money") {
            displayValue = "$" + item.value.toLocaleString() + "B";
            suffix = ` (${item.yoy_pct > 0 ? '+' : ''}${item.yoy_pct}% YoY)`;
          } else if (key === "jobless_claims") {
            displayValue = item.value.toLocaleString();
          } else {
            // rates / percents
            displayValue = item.value.toLocaleString() + "%";
          }

          const isNegative = item.signal.includes("Tightening") || item.signal.includes("Contraction") || item.signal.includes("Rising Stress") || item.signal.includes("Labor Weakening") || item.signal.includes("Tight Capacity");
          const badgeClass = isNegative ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400";
          const color = isNegative ? "#ef4444" : "#10b981";

          // Ensure all charts show exactly the same 2-year time range
          const cutoffDate = new Date();
          cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
          const cutoffStr = cutoffDate.toISOString().split('T')[0];

          const seriesData = series && series[key] ? series[key].data.filter((d: any) => d[0] >= cutoffStr).map((d: any) => ({ date: d[0], value: d[1] })) : [];

          return (
            <a
              key={key}
              href={item.source}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="text-xs text-zinc-400 mb-1 font-medium">{item.name}</div>
                
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-2xl font-semibold text-zinc-100">
                    {displayValue}
                  </span>
                  {suffix && <span className="text-sm font-medium text-zinc-400 mb-1">{suffix}</span>}
                </div>

                <div className="mb-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                    {item.signal}
                  </span>
                </div>

                <p className="text-xs text-zinc-500 leading-snug mb-3">
                  {item.interpretation}
                </p>
              </div>

              {seriesData.length > 0 && (
                <div style={{ width: "100%", height: 60, marginTop: "auto" }}>
                  <ResponsiveContainer>
                    <AreaChart data={seriesData} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
                      <defs>
                        <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
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
                        width={30}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val: number) => {
                          if (val >= 1000) return (val/1000).toFixed(0) + "k";
                          return val.toString();
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        fill={`url(#grad-${key})`}
                        strokeWidth={1.5}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
