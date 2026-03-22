"use client";

import { useEffect, useState } from "react";
import type { Indicators, SeriesFile } from "@/lib/types";
import { fetchIndicators, fetchAllSeries } from "@/lib/data";
import StageIndicator from "@/components/StageIndicator";
import BarometerCard from "@/components/BarometerCard";
import AlertsPanel from "@/components/AlertsPanel";
import StageTimeline from "@/components/StageTimeline";
import { MacroIndicatorsPanel } from "@/components/MacroIndicatorsPanel";

export default function Home() {
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [series, setSeries] = useState<Record<string, SeriesFile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [ind, ser] = await Promise.all([fetchIndicators(), fetchAllSeries()]);
        setIndicators(ind);
        setSeries(ser);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg" style={{ color: "var(--text-muted)" }}>Loading market data...</div>
      </div>
    );
  }

  if (error || !indicators) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg" style={{ color: "var(--accent-red)" }}>Error: {error || "No data"}</div>
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          Cycle Dashboard
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Pring&apos;s 6-Stage Business Cycle Model — live data from FRED &amp; Yahoo Finance
        </p>
      </header>

      {/* Stage indicator */}
      <StageIndicator
        stage={indicators.stage}
        allocation={indicators.allocation}
        computedAt={indicators.computed_at}
      />

      {/* 3 Barometer cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <BarometerCard
          barometer={indicators.barometers.bonds}
          series={series.treasury_10y}
          label="Bond Barometer"
        />
        <BarometerCard
          barometer={indicators.barometers.equities}
          series={series.sp500}
          label="Equity Barometer"
        />
        <BarometerCard
          barometer={indicators.barometers.commodities}
          series={series.commodity_djp}
          label="Commodity Barometer"
        />
      </div>

      <div className="mb-6">
        <MacroIndicatorsPanel indicators={indicators} series={series} />
      </div>

      {/* Threshold alerts */}
      <AlertsPanel alerts={indicators.threshold_alerts} series={series} />

      {/* Stage reference table */}
      <StageTimeline
        currentStage={indicators.stage.stage}
        stageReference={indicators.stage_reference}
      />

      {/* Footer */}
      <footer className="mt-12 pt-6 text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
        <p>
          Model: {indicators.model_reference}. Data updates daily via GitHub Actions.
          All signals computed from raw data — no hardcoded values.
        </p>
        <p className="mt-1">
          <a
            href="https://github.com/lzcai-prod/cycle-dashboard"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent-blue)" }}
          >
            View source on GitHub →
          </a>
        </p>
      </footer>
    </main>
  );
}
