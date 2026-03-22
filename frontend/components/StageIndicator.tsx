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
    <div className="rounded-xl p-6 mb-6" style={{ background: "var(--bg-card)", border: `1px solid ${color}40` }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>Current Business Cycle Stage</div>
          <div className="text-3xl font-bold mt-1" style={{ color }}>
            {stageNum ? `Stage ${stageNum}` : "Indeterminate"}
          </div>
          <div className="text-xl mt-1" style={{ color: "var(--text-primary)" }}>{stage.label}</div>
        </div>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
          style={{ background: `${color}20`, color, border: `3px solid ${color}` }}
        >
          {stageNum || "?"}
        </div>
      </div>

      <p className="mb-4" style={{ color: "var(--text-secondary)" }}>{desc}</p>

      {/* Allocation guidance */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {(["bonds", "equities", "commodities", "cash"] as const).map((asset) => {
          const val = allocation[asset];
          const allocColor =
            val === "overweight" ? "var(--accent-green)" :
            val === "underweight" ? "var(--accent-red)" :
            val === "raise" || val === "maximum" ? "var(--accent-yellow)" :
            val === "reduce" || val === "low" ? "var(--accent-blue)" :
            "var(--text-muted)";
          return (
            <div key={asset} className="rounded-lg p-3 text-center" style={{ background: "var(--bg-primary)" }}>
              <div className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>{asset}</div>
              <div className="text-sm font-semibold mt-1" style={{ color: allocColor }}>{val}</div>
            </div>
          );
        })}
      </div>

      <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>{allocation.rationale}</p>

      <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        Last computed: {new Date(computedAt).toLocaleString()}
      </div>
    </div>
  );
}
