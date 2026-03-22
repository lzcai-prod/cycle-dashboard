"use client";

import { STAGE_COLORS } from "@/lib/types";

interface StageRef {
  label: string;
  bonds: string;
  equities: string;
  commodities: string;
}

interface Props {
  currentStage: number | null;
  stageReference: Record<string, StageRef>;
}

export default function StageTimeline({ currentStage, stageReference }: Props) {
  const stages = [1, 2, 3, 4, 5, 6];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
      <h2 className="text-xl font-medium text-white mb-4">
        Pring&apos;s 6-Stage Business Cycle
      </h2>

      {/* Visual cycle bar */}
      <div className="flex gap-1 mb-6">
        {stages.map((s) => {
          const isCurrent = s === currentStage;
          const color = STAGE_COLORS[s] || "#71717a";
          return (
            <div
              key={s}
              className="flex-1 rounded-md py-3 text-center text-xs font-bold transition-all"
              style={{
                background: isCurrent ? color : `${color}20`,
                color: isCurrent ? "#fff" : color,
                border: isCurrent ? `2px solid ${color}` : "2px solid transparent",
                transform: isCurrent ? "scale(1.05)" : "scale(1)",
              }}
            >
              Stage {s}
            </div>
          );
        })}
      </div>

      {/* Stage details table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-800">
              <th className="text-left py-3 px-2 font-medium">Stage</th>
              <th className="text-left py-3 px-2 font-medium">Phase</th>
              <th className="text-center py-3 px-2 font-medium">Bonds</th>
              <th className="text-center py-3 px-2 font-medium">Equities</th>
              <th className="text-center py-3 px-2 font-medium">Commodities</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => {
              const ref = stageReference[String(s)];
              if (!ref) return null;
              const isCurrent = s === currentStage;
              const color = STAGE_COLORS[s];
              return (
                <tr
                  key={s}
                  className="border-b border-zinc-800/50"
                  style={{
                    background: isCurrent ? `${color}15` : "transparent",
                    borderLeft: isCurrent ? `3px solid ${color}` : "3px solid transparent",
                  }}
                >
                  <td className="py-3 px-3 font-bold" style={{ color }}>{s}</td>
                  <td className="py-3 px-2 text-zinc-300">
                    {ref.label} {isCurrent && <span className="text-zinc-500 ml-1 italic text-[10px]">👈 You are here</span>}
                  </td>
                  <td className="py-3 px-2 text-center font-bold">
                    <span className={ref.bonds === "rising" ? "text-emerald-400" : "text-red-400"}>
                      {ref.bonds === "rising" ? "↑" : "↓"}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center font-bold">
                    <span className={ref.equities === "rising" ? "text-emerald-400" : "text-red-400"}>
                      {ref.equities === "rising" ? "↑" : "↓"}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center font-bold">
                    <span className={ref.commodities === "rising" ? "text-emerald-400" : "text-red-400"}>
                      {ref.commodities === "rising" ? "↑" : "↓"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
