"use client";

import { Info } from "lucide-react";

export function MacroIndicatorsPanel({ indicators }: { indicators: any }) {
  if (!indicators || !indicators.macro_indicators) return null;

  const macro = indicators.macro_indicators;
  
  // Convert dict to array
  const items = Object.values(macro) as any[];

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
        {items.map((item, idx) => (
          <a
            key={idx}
            href={item.source}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 transition-colors"
          >
            <div className="text-xs text-zinc-400 mb-1 font-medium">{item.name}</div>
            
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-semibold text-zinc-100">
                {item.value.toLocaleString()}
                {item.name.includes("YoY") || item.name.includes("Utilization") ? "%" : ""}
              </span>
            </div>

            <div className="mb-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item.signal.includes("Tightening") || item.signal.includes("Contraction") || item.signal.includes("Rising Stress") || item.signal.includes("Labor Weakening") || item.signal.includes("Tight Capacity")
                  ? "bg-red-500/10 text-red-400"
                  : "bg-emerald-500/10 text-emerald-400"
              }`}>
                {item.signal}
              </span>
            </div>

            <p className="text-xs text-zinc-500 leading-snug">
              {item.interpretation}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
