"use client";

import type { ThresholdAlert } from "@/lib/types";

interface Props {
  alerts: Record<string, ThresholdAlert>;
}

function isTriggered(alert: ThresholdAlert): boolean {
  return !!(alert.triggered || alert.level_triggered || alert.widening_triggered);
}

function getAlertColor(alert: ThresholdAlert): string {
  if (isTriggered(alert)) return "var(--accent-red)";
  const interp = (alert.interpretation || "").toLowerCase();
  if (interp.includes("elevated") || interp.includes("warning")) return "var(--accent-yellow)";
  return "var(--accent-green)";
}

export default function AlertsPanel({ alerts }: Props) {
  const entries = Object.entries(alerts);

  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-card)" }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        Supporting Indicators & Thresholds
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map(([key, alert]) => {
          const color = getAlertColor(alert);
          const val = alert.value ?? alert.current_price ?? "N/A";
          return (
            <div
              key={key}
              className="rounded-lg p-3"
              style={{ background: "var(--bg-primary)", borderLeft: `3px solid ${color}` }}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {alert.name}
                </div>
                <div className="text-xs px-2 py-0.5 rounded" style={{ background: `${color}20`, color }}>
                  {isTriggered(alert) ? "TRIGGERED" : (alert.interpretation || "normal")}
                </div>
              </div>
              <div className="text-xl font-mono font-bold mt-1" style={{ color }}>
                {typeof val === "number" ? val.toFixed(2) : val}
              </div>
              <a
                href={alert.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs mt-1 inline-block"
                style={{ color: "var(--accent-blue)" }}
              >
                FRED →
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
