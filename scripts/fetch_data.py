"""
Cycle Dashboard — Data Pipeline (Step 1)

Fetches market data from FRED API + Yahoo Finance, computes Pring's 3 barometers
(bonds, equities, commodities), determines the current business cycle stage,
and outputs a fully transparent JSON with every calculation step visible.

NO HARDCODED SIGNALS. Every signal is derived from raw data.

Data Sources (all free, all public):
  - FRED API (St. Louis Fed): Treasury yields, credit spreads, VIX, Sahm Rule, oil, yield curve
  - Yahoo Finance: S&P 500, commodity ETFs

Usage:
  FRED_API_KEY=your_key python scripts/fetch_data.py
"""

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Moving average period for barometers (Pring uses ~10-month / 200-day)
MA_PERIOD_DAYS = 200
MA_PERIOD_LABEL = "200-day (~10 month)"

# FRED series IDs
FRED_SERIES = {
    "treasury_10y":   "DGS10",       # 10-Year Treasury Constant Maturity Rate
    "yield_curve":    "T10Y2Y",      # 10Y minus 2Y Treasury spread
    "credit_spread":  "BAMLH0A0HYM2",# ICE BofA US High Yield OAS
    "vix":            "VIXCLS",      # CBOE VIX
    "sahm_rule":      "SAHMREALTIME",# Sahm Rule Recession Indicator
    "oil_wti":        "DCOILWTICO",  # WTI Crude Oil Price
}

# Yahoo Finance tickers
YAHOO_TICKERS = {
    "sp500":     "^GSPC",   # S&P 500 Index
    "commodity": "DJP",     # iPath Bloomberg Commodity ETN (proxy)
}

# FRED series URLs for citation
FRED_BASE_URL = "https://fred.stlouisfed.org/series/"

# Pring's 6-stage mapping: (bonds_signal, equities_signal, commodities_signal) -> stage
# bonds_signal: "rising" means bond PRICES rising (yields falling)
# "falling" means bond PRICES falling (yields rising)
STAGE_MAP = {
    ("rising",  "falling", "falling"): (1, "Late Recession"),
    ("rising",  "rising",  "falling"): (2, "Early Recovery"),
    ("rising",  "rising",  "rising"):  (2.5, "Recovery/Expansion Transition"),  # all rising — between 2 and 3
    ("falling", "rising",  "rising"):  (3, "Mid Expansion"),
    ("falling", "rising",  "falling"): (4, "Late Expansion"),      # commodities rolling over
    ("falling", "falling", "rising"):  (5, "Early Downturn"),
    ("falling", "falling", "falling"): (6, "Full Recession"),
    ("rising",  "falling", "rising"):  (5.5, "Mixed — Recession with Commodity Inflation"),  # stagflation-like
}

# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

def fetch_fred_series(fred, series_id: str, lookback_days: int = 500) -> pd.Series:
    """Fetch a FRED series. Returns a pandas Series indexed by date."""
    start = datetime.now() - timedelta(days=lookback_days)
    try:
        data = fred.get_series(series_id, observation_start=start)
        data = data.dropna()
        if data.empty:
            raise ValueError(f"FRED series {series_id} returned no data")
        return data
    except Exception as e:
        print(f"  ⚠ Failed to fetch FRED/{series_id}: {e}", file=sys.stderr)
        return pd.Series(dtype=float)


def fetch_yahoo_series(ticker: str, lookback_days: int = 500) -> pd.Series:
    """Fetch closing prices from Yahoo Finance. Returns a pandas Series."""
    import yfinance as yf
    start = datetime.now() - timedelta(days=lookback_days)
    try:
        df = yf.download(ticker, start=start.strftime("%Y-%m-%d"), progress=False, auto_adjust=True)
        if df.empty:
            raise ValueError(f"Yahoo/{ticker} returned no data")
        # yfinance may return MultiIndex columns; flatten
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        series = df["Close"].dropna()
        series.index = series.index.tz_localize(None)  # remove timezone
        return series
    except Exception as e:
        print(f"  ⚠ Failed to fetch Yahoo/{ticker}: {e}", file=sys.stderr)
        return pd.Series(dtype=float)


# ---------------------------------------------------------------------------
# Signal computation (fully transparent)
# ---------------------------------------------------------------------------

def compute_barometer(series: pd.Series, name: str, invert: bool = False,
                      invert_reason: str = "") -> dict:
    """
    Compute a barometer signal from a price/yield series.

    Args:
        series: Time series of values (prices or yields)
        name: Human-readable name
        invert: If True, the signal is inverted (e.g., rising yields = falling bonds)
        invert_reason: Explanation of why inversion applies

    Returns:
        Dict with full calculation chain
    """
    if series.empty:
        return {
            "name": name,
            "status": "error",
            "error": "No data available",
            "signal": "unknown",
        }

    current_value = float(series.iloc[-1])
    current_date = series.index[-1].strftime("%Y-%m-%d")

    # Compute moving average
    ma = series.rolling(window=MA_PERIOD_DAYS, min_periods=int(MA_PERIOD_DAYS * 0.8)).mean()
    ma_clean = ma.dropna()

    if ma_clean.empty:
        return {
            "name": name,
            "status": "error",
            "error": f"Not enough data to compute {MA_PERIOD_LABEL} moving average",
            "signal": "unknown",
        }

    ma_value = float(ma_clean.iloc[-1])
    ma_start_date = series.index[max(0, len(series) - MA_PERIOD_DAYS)].strftime("%Y-%m-%d")
    ma_end_date = current_date

    # Raw comparison
    is_above_ma = current_value > ma_value
    pct_diff = ((current_value - ma_value) / ma_value) * 100

    # Determine raw directional signal
    raw_signal = "above_ma" if is_above_ma else "below_ma"

    # Apply inversion if needed (e.g., yields → bond prices)
    if invert:
        # Above MA in yields = falling bond prices = bonds DOWN
        final_signal = "falling" if is_above_ma else "rising"
        signal_logic = (
            f"Current value ({current_value:.4f}) is {'above' if is_above_ma else 'below'} "
            f"the {MA_PERIOD_LABEL} MA ({ma_value:.4f}). "
            f"{invert_reason} "
            f"Therefore signal = '{final_signal}'."
        )
    else:
        # Above MA in prices = asset rising = UP
        final_signal = "rising" if is_above_ma else "falling"
        signal_logic = (
            f"Current value ({current_value:.2f}) is {'above' if is_above_ma else 'below'} "
            f"the {MA_PERIOD_LABEL} MA ({ma_value:.2f}). "
            f"Price above MA → signal = '{final_signal}'."
        )

    # Recent trend (last 20 days slope)
    recent = series.tail(20)
    if len(recent) >= 2:
        slope = (float(recent.iloc[-1]) - float(recent.iloc[0])) / len(recent)
        recent_trend = "rising" if slope > 0 else "falling"
    else:
        slope = 0
        recent_trend = "unknown"

    return {
        "name": name,
        "status": "ok",
        "calculation_steps": {
            "raw_value": round(current_value, 4),
            "raw_value_date": current_date,
            "ma_value": round(ma_value, 4),
            "ma_period": MA_PERIOD_LABEL,
            "ma_window_start": ma_start_date,
            "ma_window_end": ma_end_date,
            "data_points_in_window": len(series.tail(MA_PERIOD_DAYS)),
            "comparison": raw_signal,
            "pct_diff_from_ma": round(pct_diff, 2),
            "inversion_applied": invert,
            "inversion_reason": invert_reason if invert else "N/A — direct price comparison",
            "signal_logic": signal_logic,
            "recent_20d_trend": recent_trend,
            "recent_20d_slope": round(slope, 6),
        },
        "signal": final_signal,
        "series_last_30": [
            {"date": d.strftime("%Y-%m-%d"), "value": round(float(v), 4)}
            for d, v in series.tail(30).items()
        ],
    }


def compute_supporting_indicator(series: pd.Series, name: str, source_id: str,
                                  thresholds: dict = None) -> dict:
    """
    Compute a supporting indicator with transparent value reporting.

    Args:
        series: Time series
        name: Human-readable name
        source_id: FRED series ID or Yahoo ticker
        thresholds: Dict of named thresholds for context, e.g. {"recession": 0.5}
    """
    if series.empty:
        return {
            "name": name,
            "status": "error",
            "error": "No data available",
            "source": f"{FRED_BASE_URL}{source_id}",
        }

    current_value = float(series.iloc[-1])
    current_date = series.index[-1].strftime("%Y-%m-%d")

    # Staleness check
    days_old = (datetime.now() - series.index[-1].to_pydatetime().replace(tzinfo=None)).days
    freshness = "fresh" if days_old <= 7 else ("stale" if days_old <= 30 else "very_stale")

    result = {
        "name": name,
        "status": "ok",
        "value": round(current_value, 4),
        "date": current_date,
        "days_since_update": days_old,
        "freshness": freshness,
        "source": f"{FRED_BASE_URL}{source_id}",
    }

    # Add threshold context if provided
    if thresholds:
        threshold_checks = {}
        for label, threshold_val in thresholds.items():
            threshold_checks[label] = {
                "threshold": threshold_val,
                "current_value": round(current_value, 4),
                "triggered": current_value >= threshold_val if "above" in label or "warning" in label or "recession" in label
                             else current_value <= threshold_val,
                "distance": round(current_value - threshold_val, 4),
            }
        result["threshold_checks"] = threshold_checks

    # Historical context
    if len(series) >= 60:
        result["historical_context"] = {
            "current": round(current_value, 4),
            "avg_1y": round(float(series.tail(252).mean()), 4) if len(series) >= 252 else None,
            "min_1y": round(float(series.tail(252).min()), 4) if len(series) >= 252 else None,
            "max_1y": round(float(series.tail(252).max()), 4) if len(series) >= 252 else None,
            "percentile_1y": round(float(
                (series.tail(252) <= current_value).mean() * 100
            ), 1) if len(series) >= 252 else None,
        }

    result["series_last_10"] = [
        {"date": d.strftime("%Y-%m-%d"), "value": round(float(v), 4)}
        for d, v in series.tail(10).items()
    ]

    return result


def determine_stage(bonds_signal: str, equities_signal: str, commodities_signal: str) -> dict:
    """
    Determine Pring's business cycle stage from 3 barometer signals.
    Returns stage info with full logic explanation.
    """
    key = (bonds_signal, equities_signal, commodities_signal)

    if key in STAGE_MAP:
        stage_num, stage_label = STAGE_MAP[key]
        matched = True
    else:
        # Unknown combination
        stage_num = None
        stage_label = "Indeterminate"
        matched = False

    return {
        "stage": stage_num,
        "stage_label": stage_label,
        "determination_logic": {
            "bonds_signal": bonds_signal,
            "equities_signal": equities_signal,
            "commodities_signal": commodities_signal,
            "combination": f"Bonds {bonds_signal.upper()}, Equities {equities_signal.upper()}, Commodities {commodities_signal.upper()}",
            "matched_known_stage": matched,
            "note": (
                "Stage determined by Pring's 6-stage business cycle model. "
                "Each barometer (bonds, equities, commodities) is classified as RISING or FALLING "
                f"based on whether the current value is above or below its {MA_PERIOD_LABEL} moving average. "
                "The combination of 3 signals maps to a specific cycle stage."
            ),
        },
        "stage_reference": {
            "1": "Late Recession — Bonds ↑, Equities ↓, Commodities ↓",
            "2": "Early Recovery — Bonds ↑, Equities ↑, Commodities ↓",
            "3": "Mid Expansion — Bonds ↓, Equities ↑, Commodities ↑",
            "4": "Late Expansion — Bonds ↓, Equities ↑ (topping), Commodities ↑",
            "5": "Early Downturn — Bonds ↓, Equities ↓, Commodities ↑ (topping)",
            "6": "Full Recession — Bonds ↓, Equities ↓, Commodities ↓",
        },
        "allocation_guidance": _get_allocation_guidance(stage_num),
    }


def _get_allocation_guidance(stage) -> dict:
    """Return Pring's recommended allocation tilt for a given stage."""
    guidance = {
        1:   {"bonds": "overweight", "equities": "underweight", "commodities": "underweight", "cash": "high",
              "rationale": "Bonds rally as rates fall. Equities still declining. Cash is king until equity barometer turns."},
        2:   {"bonds": "overweight", "equities": "overweight",  "commodities": "underweight", "cash": "reduce",
              "rationale": "Both bonds and equities rising — the sweet spot. Reduce cash, deploy into risk assets."},
        2.5: {"bonds": "neutral",    "equities": "overweight",  "commodities": "neutral",     "cash": "low",
              "rationale": "All three rising — transitional. Bonds may be topping. Favor equities."},
        3:   {"bonds": "underweight","equities": "overweight",  "commodities": "overweight",  "cash": "low",
              "rationale": "Bonds falling as rates rise. Equities and commodities benefit from expansion. Minimal cash."},
        4:   {"bonds": "underweight","equities": "neutral",     "commodities": "overweight",  "cash": "low",
              "rationale": "Equities topping out, commodities still strong. Begin watching for equity weakness."},
        5:   {"bonds": "underweight","equities": "underweight", "commodities": "neutral",     "cash": "raise",
              "rationale": "Equities falling, commodities topping. Raise cash. Defensive positioning."},
        5.5: {"bonds": "neutral",    "equities": "underweight", "commodities": "neutral",     "cash": "raise",
              "rationale": "Mixed signals — stagflation-like. Bonds rising but equities weak. Be cautious."},
        6:   {"bonds": "neutral",    "equities": "underweight", "commodities": "underweight", "cash": "maximum",
              "rationale": "Everything falling. Maximum cash. Wait for bond barometer to turn up (Stage 1 signal)."},
    }
    return guidance.get(stage, {
        "bonds": "unknown", "equities": "unknown", "commodities": "unknown", "cash": "unknown",
        "rationale": "Barometer combination does not map to a standard Pring stage. Review individual signals."
    })


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def main():
    print("=" * 70)
    print("CYCLE DASHBOARD — DATA PIPELINE")
    print(f"Run time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print("=" * 70)

    # --- Check FRED API key ---
    fred_api_key = os.environ.get("FRED_API_KEY")
    if not fred_api_key:
        print("\n❌ FRED_API_KEY environment variable not set.")
        print("   Get a free key at: https://fred.stlouisfed.org/docs/api/api_key.html")
        print("   Then run: FRED_API_KEY=your_key python scripts/fetch_data.py")
        sys.exit(1)

    from fredapi import Fred
    fred = Fred(api_key=fred_api_key)

    errors = []

    # --- Fetch all data ---
    print("\n📡 Fetching data...")

    print("  FRED/DGS10 (10Y Treasury yield)...")
    treasury_10y = fetch_fred_series(fred, "DGS10")

    print("  Yahoo/^GSPC (S&P 500)...")
    sp500 = fetch_yahoo_series("^GSPC")

    print("  Yahoo/DJP (Bloomberg Commodity ETN)...")
    commodity = fetch_yahoo_series("DJP")

    # Fallback: if DJP fails, try PPIACO from FRED
    commodity_source = "Yahoo/DJP"
    if commodity.empty:
        print("  ⚠ DJP failed, trying FRED/PPIACO (Producer Price Index) as commodity proxy...")
        commodity = fetch_fred_series(fred, "PPIACO")
        commodity_source = "FRED/PPIACO"

    print("  FRED/T10Y2Y (Yield curve spread)...")
    yield_curve = fetch_fred_series(fred, "T10Y2Y")

    print("  FRED/BAMLH0A0HYM2 (HY credit spread)...")
    credit_spread = fetch_fred_series(fred, "BAMLH0A0HYM2")

    print("  FRED/VIXCLS (VIX)...")
    vix = fetch_fred_series(fred, "VIXCLS")

    print("  FRED/SAHMREALTIME (Sahm Rule)...")
    sahm = fetch_fred_series(fred, "SAHMREALTIME")

    print("  FRED/DCOILWTICO (WTI Oil)...")
    oil = fetch_fred_series(fred, "DCOILWTICO")

    # --- Compute barometers ---
    print("\n📊 Computing barometers...")

    print("\n  [BOND BAROMETER]")
    bonds = compute_barometer(
        treasury_10y,
        name="Bond Barometer (via 10Y Treasury Yield)",
        invert=True,
        invert_reason="Yields are INVERSE to bond prices — yield above MA means bond prices are falling (bearish for bonds).",
    )
    print(f"    Raw yield: {bonds.get('calculation_steps', {}).get('raw_value', 'N/A')}")
    print(f"    MA yield:  {bonds.get('calculation_steps', {}).get('ma_value', 'N/A')}")
    print(f"    Signal:    {bonds.get('signal', 'N/A')}")

    print("\n  [EQUITY BAROMETER]")
    equities = compute_barometer(
        sp500,
        name="Equity Barometer (S&P 500)",
        invert=False,
    )
    print(f"    Raw price: {equities.get('calculation_steps', {}).get('raw_value', 'N/A')}")
    print(f"    MA price:  {equities.get('calculation_steps', {}).get('ma_value', 'N/A')}")
    print(f"    Signal:    {equities.get('signal', 'N/A')}")

    print("\n  [COMMODITY BAROMETER]")
    commodities = compute_barometer(
        commodity,
        name=f"Commodity Barometer ({commodity_source})",
        invert=False,
    )
    print(f"    Raw price: {commodities.get('calculation_steps', {}).get('raw_value', 'N/A')}")
    print(f"    MA price:  {commodities.get('calculation_steps', {}).get('ma_value', 'N/A')}")
    print(f"    Signal:    {commodities.get('signal', 'N/A')}")

    # --- Determine stage ---
    print("\n🔄 Determining cycle stage...")
    stage_info = determine_stage(
        bonds.get("signal", "unknown"),
        equities.get("signal", "unknown"),
        commodities.get("signal", "unknown"),
    )
    print(f"    Combination: {stage_info['determination_logic']['combination']}")
    print(f"    Stage:       {stage_info['stage']} — {stage_info['stage_label']}")

    # --- Compute supporting indicators ---
    print("\n📋 Computing supporting indicators...")

    indicators = {}

    indicators["yield_curve"] = compute_supporting_indicator(
        yield_curve, "Yield Curve (10Y - 2Y)", "T10Y2Y",
        thresholds={
            "recession_warning_inversion": 0,  # negative = inverted
        }
    )

    indicators["credit_spread"] = compute_supporting_indicator(
        credit_spread, "HY Credit Spread (OAS)", "BAMLH0A0HYM2",
        thresholds={
            "warning_elevated": 5.0,   # 500bps = stress
            "recession_crisis": 8.0,   # 800bps = crisis
        }
    )

    indicators["vix"] = compute_supporting_indicator(
        vix, "VIX (Implied Volatility)", "VIXCLS",
        thresholds={
            "warning_elevated": 25.0,
            "warning_high_fear": 30.0,
            "recession_panic": 40.0,
        }
    )

    indicators["sahm_rule"] = compute_supporting_indicator(
        sahm, "Sahm Rule Recession Indicator", "SAHMREALTIME",
        thresholds={
            "recession_trigger": 0.5,  # ≥ 0.5 = recession signal
        }
    )

    indicators["oil_wti"] = compute_supporting_indicator(
        oil, "WTI Crude Oil Price", "DCOILWTICO",
    )
    # Add YoY change for oil (important for recession signal)
    if not oil.empty and len(oil) >= 252:
        current_oil = float(oil.iloc[-1])
        year_ago_oil = float(oil.iloc[-252]) if len(oil) >= 252 else float(oil.iloc[0])
        oil_yoy = ((current_oil - year_ago_oil) / year_ago_oil) * 100
        indicators["oil_wti"]["yoy_change"] = {
            "current": round(current_oil, 2),
            "year_ago": round(year_ago_oil, 2),
            "yoy_pct_change": round(oil_yoy, 2),
            "note": "Hamilton (1983, 2009): rapid oil price doublings precede recessions. YoY > 80-100% is historically dangerous.",
        }

    # ISM PMI note — not freely available on FRED as a clean series
    indicators["ism_pmi"] = {
        "name": "ISM Manufacturing PMI",
        "status": "manual_input_required",
        "note": (
            "ISM PMI is not freely available as a downloadable FRED time series. "
            "The official source is ismworld.org (subscription required for historical data). "
            "FRED has related series (MANEMP for manufacturing employment, NAPM was discontinued). "
            "For this dashboard, ISM PMI should be manually updated monthly or sourced via "
            "Trading Economics / MacroMicro. Current ISM PMI (Feb 2026): check ismworld.org."
        ),
        "thresholds": {
            "expansion_contraction": 50.0,
            "recession_warning": 45.0,
        },
        "source": "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/",
    }

    for key, ind in indicators.items():
        status = ind.get("status", "?")
        val = ind.get("value", "N/A")
        print(f"    {ind['name']}: {val} ({status})")

    # --- Assemble output ---
    output = {
        "_metadata": {
            "project": "Cycle Dashboard",
            "description": "Pring's 6-Stage Business Cycle Model with live market data",
            "updated_utc": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "methodology": (
                "Each barometer compares the current value to its "
                f"{MA_PERIOD_LABEL} moving average. "
                "Bond barometer inverts the yield signal (rising yields = falling bond prices). "
                "The combination of 3 barometer signals determines the cycle stage per Pring's model."
            ),
            "ma_period_days": MA_PERIOD_DAYS,
            "data_sources": {
                "treasury_10y": f"{FRED_BASE_URL}DGS10",
                "sp500": "https://finance.yahoo.com/quote/%5EGSPC/",
                "commodity_proxy": f"{FRED_BASE_URL}PPIACO" if commodity_source == "FRED/PPIACO"
                                   else "https://finance.yahoo.com/quote/DJP/",
                "yield_curve": f"{FRED_BASE_URL}T10Y2Y",
                "credit_spread": f"{FRED_BASE_URL}BAMLH0A0HYM2",
                "vix": f"{FRED_BASE_URL}VIXCLS",
                "sahm_rule": f"{FRED_BASE_URL}SAHMREALTIME",
                "oil_wti": f"{FRED_BASE_URL}DCOILWTICO",
                "ism_pmi": "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/",
            },
            "reference": {
                "model": "Martin Pring, 'The Investor's Guide to Active Asset Allocation' (2006)",
                "bond_barometer_note": "Bond prices are inverse to yields. We track the 10Y yield and invert the signal.",
            },
        },
        "current_stage": stage_info,
        "barometers": {
            "bonds": bonds,
            "equities": equities,
            "commodities": commodities,
        },
        "supporting_indicators": indicators,
    }

    # --- Write output ---
    out_path = Path(__file__).parent.parent / "data" / "latest.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Output written to: {out_path}")
    print(f"   File size: {out_path.stat().st_size:,} bytes")

    # --- Print summary ---
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  Stage: {stage_info['stage']} — {stage_info['stage_label']}")
    print(f"  Bonds:       {bonds.get('signal', '?').upper()}")
    print(f"  Equities:    {equities.get('signal', '?').upper()}")
    print(f"  Commodities: {commodities.get('signal', '?').upper()}")
    alloc = stage_info.get("allocation_guidance", {})
    if alloc:
        print(f"\n  Allocation guidance:")
        print(f"    Bonds:       {alloc.get('bonds', '?')}")
        print(f"    Equities:    {alloc.get('equities', '?')}")
        print(f"    Commodities: {alloc.get('commodities', '?')}")
        print(f"    Cash:        {alloc.get('cash', '?')}")
        print(f"    Rationale:   {alloc.get('rationale', '?')}")
    print("=" * 70)


if __name__ == "__main__":
    main()
