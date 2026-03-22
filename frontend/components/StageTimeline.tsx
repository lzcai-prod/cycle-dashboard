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
    <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-card)" }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        Pring&apos;s 6-Stage Business Cycle
      </h2>

      {/* Visual cycle bar */}
      <div className="flex gap-1 mb-4">
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
            <tr style={{ color: "var(--text-muted)" }}>
              <th className="text-left py-2 px-2">Stage</th>
              <th className="text-left py-2 px-2">Phase</th>
              <th className="text-center py-2 px-2">Bonds</th>
              <th className="text-center py-2 px-2">Equities</th>
              <th className="text-center py-2 px-2">Commodities</th>
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
                  style={{
                    background: isCurrent ? `${color}15` : "transparent",
                    borderLeft: isCurrent ? `3px solid ${color}` : "3px solid transparent",
                  }}
                >
                  <td className="py-2 px-2 font-bold" style={{ color }}>{s}</td>
                  <td className="py-2 px-2" style={{ color: isCurrent ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    {ref.label} {isCurrent && "← You are here"}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span style={{ color: ref.bonds === "rising" ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {ref.bonds === "rising" ? "↑" : "↓"}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span style={{ color: ref.equities === "rising" ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {ref.equities === "rising" ? "↑" : "↓"}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span style={{ color: ref.commodities === "rising" ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {ref.commodities === "rising" ? "↑" : "↓"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        Source: Martin Pring, &quot;The Investor&apos;s Guide to Active Asset Allocation&quot; (2006).
        Each barometer compares the asset to its 200-day moving average.
      </div>
    </div>
  );
}
