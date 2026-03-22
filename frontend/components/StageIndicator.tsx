"use client";

import type { StageInfo, Allocation } from "@/lib/types";
import { STAGE_COLORS, STAGE_DESCRIPTIONS } from "@/lib/types";

interface Props {
  stage: StageInfo;
  allocation: Allocation;
  computedAt: string;
}

export default function StageIndicator({ stage, allocation, computedAt }: Props) {
  const stageNum = stage.stage ?? 0;
  const color = STAGE_COLORS[stageNum] || "#71717a";
  const desc = STAGE_DESCRIPTIONS[stageNum] || "Unable to determine cycle stage.";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm text-zinc-400">Current Business Cycle Stage</div>
          <div className="text-3xl font-bold mt-1" style={{ color }}>
            {stageNum ? `Stage ${stageNum}` : "Indeterminate"}
          </div>
          <div className="text-xl mt-1 text-zinc-100">{stage.label}</div>
        </div>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
          style={{ background: `${color}20`, color, border: `2px solid ${color}` }}
        >
          {stageNum || "?"}
        </div>
      </div>

      <p className="mb-3 text-zinc-300">{desc}</p>

      <div className="rounded-lg p-3 mb-4 text-xs leading-relaxed bg-zinc-800/50 text-zinc-400">
        <span className="font-semibold text-zinc-300">How is the stage determined?</span>{" "}
        Each asset class is compared to its 200-day moving average:{" "}
        <span className="text-zinc-200">Bonds</span> (10Y Treasury Yield, inverted),{" "}
        <span className="text-zinc-200">Equities</span> (S&amp;P 500),{" "}
        <span className="text-zinc-200">Commodities</span> (DJP ETN).
        The combination of rising/falling signals maps to one of Pring&apos;s 6 stages.
      </div>

      {/* Allocation guidance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {(["bonds", "equities", "commodities", "cash"] as const).map((asset) => {
          const val = allocation[asset];
          const allocColor =
            val === "overweight" ? "#10b981" : // emerald-500
            val === "underweight" ? "#ef4444" : // red-500
            val === "raise" || val === "maximum" ? "#f59e0b" : // amber-500
            val === "reduce" || val === "low" ? "#3b82f6" : // blue-500
            "#a1a1aa"; // zinc-400
          return (
            <div key={asset} className="rounded-lg p-3 text-center flex flex-col justify-center bg-zinc-800/50 border border-zinc-700/50">
              <div className="text-xs uppercase font-medium tracking-tight text-zinc-400">{asset}</div>
              <div className="text-sm font-semibold mt-1" style={{ color: allocColor }}>{val}</div>
            </div>
          );
        })}
      </div>

      <p className="text-sm italic text-zinc-500">{allocation.rationale}</p>

      <div className="mt-4 text-xs text-zinc-600">
        Last computed: {new Date(computedAt).toLocaleString()}
      </div>
    </div>
  );
}
