"""
Cycle Dashboard — Data Pipeline (Step 1 v2)

Fetches raw market data from FRED API + Yahoo Finance, computes Pring's barometers
and cycle stage, then outputs:
  - data/series/*.json   — raw time series for charts and verification
  - data/indicators.json — pre-computed signals, stage, thresholds
  - data/history.json    — stage change log over time

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

MA_PERIOD_DAYS = 200
MA_PERIOD_LABEL = "200-day (~10 month)"

FRED_SERIES = {
    "treasury_10y":  {"id": "DGS10",         "name": "10-Year Treasury Yield",       "unit": "percent",    "frequency": "daily"},
    "yield_curve":   {"id": "T10Y2Y",        "name": "Yield Curve (10Y - 2Y)",       "unit": "percent",    "frequency": "daily"},
    "credit_spread": {"id": "BAMLH0A0HYM2",  "name": "HY Credit Spread (OAS)",       "unit": "percent",    "frequency": "daily"},
    "vix":           {"id": "VIXCLS",         "name": "VIX (Implied Volatility)",     "unit": "index",      "frequency": "daily"},
    "sahm_rule":     {"id": "SAHMREALTIME",   "name": "Sahm Rule Recession Indicator","unit": "percentage_points", "frequency": "monthly"},
    "oil_wti":       {"id": "DCOILWTICO",     "name": "WTI Crude Oil Price",          "unit": "usd_per_barrel",    "frequency": "daily"},
    "discount_rate": {"id": "DPCREDIT",      "name": "Discount Rate (Primary Credit)", "unit": "percent",    "frequency": "daily"},
    "m2_money":      {"id": "M2SL",          "name": "M2 Money Supply",              "unit": "billions_usd", "frequency": "monthly"},
    "jobless_claims":{"id": "ICSA",          "name": "Initial Jobless Claims",       "unit": "claims",       "frequency": "weekly"},
    "capacity_util": {"id": "TCU",           "name": "Capacity Utilization",         "unit": "percent",      "frequency": "monthly"},
    "commercial_paper":{"id":"DCPN3M",       "name": "3-Month Commercial Paper Yield","unit": "percent",     "frequency": "daily"},
}

YAHOO_SERIES = {
    "sp500":         {"ticker": "^GSPC", "name": "S&P 500",                   "unit": "index_points", "frequency": "daily"},
    "commodity_djp": {"ticker": "DJP",   "name": "Bloomberg Commodity ETN",   "unit": "usd",          "frequency": "daily"},
}

FRED_BASE_URL = "https://fred.stlouisfed.org/series/"

# Pring's 6-stage mapping: (bonds_signal, equities_signal, commodities_signal) -> stage
STAGE_MAP = {
    ("rising",  "falling", "falling"): (1, "Late Recession"),
    ("rising",  "rising",  "falling"): (2, "Early Recovery"),
    ("rising",  "rising",  "rising"):  (2, "Early Recovery"),          # all rising — late stage 2
    ("falling", "rising",  "rising"):  (3, "Mid Expansion"),
    ("falling", "rising",  "falling"): (4, "Late Expansion"),
    ("falling", "falling", "rising"):  (5, "Early Downturn"),
    ("falling", "falling", "falling"): (6, "Full Recession"),
    ("rising",  "falling", "rising"):  (5, "Early Downturn"),          # stagflation variant
}


# ---------------------------------------------------------------------------
# Data Fetching
# ---------------------------------------------------------------------------

def fetch_fred(fred, series_id: str, lookback_days: int = 7000) -> pd.Series:
    """Fetch a FRED series. Returns pandas Series indexed by date."""
    start = datetime.now() - timedelta(days=lookback_days)
    try:
        data = fred.get_series(series_id, observation_start=start)
        data = data.dropna()
        if data.empty:
            raise ValueError(f"FRED/{series_id} returned empty")
        return data
    except Exception as e:
        print(f"  WARNING: FRED/{series_id} failed: {e}", file=sys.stderr)
        return pd.Series(dtype=float)


def fetch_yahoo(ticker: str, lookback_days: int = 7000) -> pd.Series:
    """Fetch closing prices from Yahoo Finance."""
    import yfinance as yf
    start = datetime.now() - timedelta(days=lookback_days)
    try:
        df = yf.download(ticker, start=start.strftime("%Y-%m-%d"), progress=False, auto_adjust=True)
        if df.empty:
            raise ValueError(f"Yahoo/{ticker} returned empty")
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        series = df["Close"].dropna()
        series.index = series.index.tz_localize(None)
        return series
    except Exception as e:
        print(f"  WARNING: Yahoo/{ticker} failed: {e}", file=sys.stderr)
        return pd.Series(dtype=float)


# ---------------------------------------------------------------------------
# Series output
# ---------------------------------------------------------------------------

def series_to_json(series: pd.Series, meta: dict, source_url: str) -> dict:
    """Convert a pandas Series to a clean JSON-serializable dict for data/series/."""
    data_points = [
        [d.strftime("%Y-%m-%d"), round(float(v), 4)]
        for d, v in series.items()
    ]
    return {
        "name": meta["name"],
        "unit": meta["unit"],
        "frequency": meta["frequency"],
        "source": source_url,
        "updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "count": len(data_points),
        "data": data_points,
    }


# ---------------------------------------------------------------------------
# Signal Computation
# ---------------------------------------------------------------------------

def compute_barometer(series: pd.Series, name: str, invert: bool = False,
                      invert_reason: str = "") -> dict:
    """
    Compute a barometer signal from a time series.
    Returns dict with transparent calculation chain.
    """
    if series.empty:
        return {"name": name, "status": "error", "error": "No data", "signal": "unknown"}

    current = float(series.iloc[-1])
    current_date = series.index[-1].strftime("%Y-%m-%d")

    ma = series.rolling(window=MA_PERIOD_DAYS, min_periods=int(MA_PERIOD_DAYS * 0.8)).mean()
    ma_clean = ma.dropna()
    if ma_clean.empty:
        return {"name": name, "status": "error", "error": "Insufficient data for MA", "signal": "unknown"}

    ma_val = float(ma_clean.iloc[-1])
    is_above = current > ma_val
    pct_diff = ((current - ma_val) / ma_val) * 100

    if invert:
        signal = "falling" if is_above else "rising"
    else:
        signal = "rising" if is_above else "falling"

    # Detect when signal last changed (scan backwards)
    signal_changed = None
    for i in range(len(series) - 2, max(len(series) - MA_PERIOD_DAYS, 0), -1):
        if i < len(ma) and not pd.isna(ma.iloc[i]):
            prev_above = float(series.iloc[i]) > float(ma.iloc[i])
            if prev_above != is_above:
                signal_changed = series.index[i + 1].strftime("%Y-%m-%d")
                break

    return {
        "name": name,
        "status": "ok",
        "current": round(current, 4),
        "current_date": current_date,
        "ma_200d": round(ma_val, 4),
        "pct_from_ma": round(pct_diff, 2),
        "above_ma": is_above,
        "inversion": invert,
        "inversion_reason": invert_reason if invert else None,
        "signal": signal,
        "signal_changed_date": signal_changed,
    }


def compute_macro_indicators(raw_data: dict) -> dict:
    """Compute and format Pring's specific macro leading indicators."""
    macro = {}

    # Discount Rate (DPCREDIT) - Core monetary indicator
    dr = raw_data.get("discount_rate")
    if dr is not None and not dr.empty:
        val = float(dr.iloc[-1])
        ma_200 = float(dr.tail(200).mean()) if len(dr) >= 200 else float(dr.mean())
        macro["discount_rate"] = {
            "name": "Discount Rate (Primary Credit)",
            "value": round(val, 2),
            "ma_200d": round(ma_200, 2),
            "signal": "Rising (Tightening)" if val > ma_200 else "Falling (Easing)",
            "interpretation": "The most influential indicator in the Bond Barometer. Rising rates press bond prices down.",
            "source": f"{FRED_BASE_URL}DPCREDIT"
        }

    # Money Supply (M2SL) - YoY Growth
    m2 = raw_data.get("m2_money")
    if m2 is not None and not m2.empty and len(m2) >= 12:
        val = float(m2.iloc[-1])
        yoy = ((val - float(m2.iloc[-13])) / float(m2.iloc[-13])) * 100
        macro["m2_money"] = {
            "name": "M2 Money Supply (YoY Growth)",
            "value": round(val, 2),
            "yoy_pct": round(yoy, 2),
            "signal": "Positive Liquidity" if yoy > 0 else "Liquidity Contraction",
            "interpretation": "Liquidity growth drives the transition from Stage 6 to Stage 1. Sustained contraction is a heavy drag.",
            "source": f"{FRED_BASE_URL}M2SL"
        }

    # Commercial Paper (CP3M)
    cp = raw_data.get("commercial_paper")
    if cp is not None and not cp.empty:
        val = float(cp.iloc[-1])
        ma_12 = float(cp.tail(12).mean()) if len(cp) >= 12 else float(cp.mean())
        macro["commercial_paper"] = {
            "name": "3-Month Commercial Paper Yield",
            "value": round(val, 2),
            "ma_12m": round(ma_12, 2),
            "signal": "Rising Stress" if val > ma_12 else "Falling Stress",
            "interpretation": "Primary financial component for the Stock Barometer. Rising short-term yields drain corporate liquidity.",
            "source": f"{FRED_BASE_URL}DCPN3M"
        }

    # Initial Jobless Claims (ICSA) - 4 week MA
    jc = raw_data.get("jobless_claims")
    if jc is not None and not jc.empty and len(jc) >= 4:
        val = float(jc.iloc[-1])
        ma_4wk = float(jc.tail(4).mean())
        ma_52wk = float(jc.tail(52).mean()) if len(jc) >= 52 else float(jc.mean())
        macro["jobless_claims"] = {
            "name": "Initial Jobless Claims (4-wk MA)",
            "value": round(val, 0),
            "ma_4wk": round(ma_4wk, 0),
            "ma_52wk": round(ma_52wk, 0),
            "signal": "Labor Weakening" if ma_4wk > ma_52wk else "Labor Strong",
            "interpretation": "Best high-frequency leading economic indicator. Rising claims signal economic topping.",
            "source": f"{FRED_BASE_URL}ICSA"
        }

    # Capacity Utilization (TCU)
    cu = raw_data.get("capacity_util")
    if cu is not None and not cu.empty:
        val = float(cu.iloc[-1])
        macro["capacity_util"] = {
            "name": "Capacity Utilization (Total Industry)",
            "value": round(val, 2),
            "threshold": 80.0,
            "signal": "Tight Capacity (Inflationary)" if val >= 80 else "Excess Capacity (Deflationary)",
            "interpretation": "Measures manufacturing tightness. High utilization signals late-stage expansion and impending inflation.",
            "source": f"{FRED_BASE_URL}TCU"
        }

    return macro

def compute_thresholds(indicators_raw: dict) -> dict:
    """Compute threshold alerts from raw indicator data."""
    alerts = {}

    # Yield curve inversion
    yc = indicators_raw.get("yield_curve")
    if yc is not None and not yc.empty:
        val = float(yc.iloc[-1])
        alerts["yield_curve_inversion"] = {
            "name": "Yield Curve Inversion (10Y - 2Y < 0)",
            "value": round(val, 4),
            "threshold": 0,
            "triggered": val < 0,
            "interpretation": "inverted — recession warning" if val < 0 else "normal — positive slope",
            "source": f"{FRED_BASE_URL}T10Y2Y",
        }

    # Credit spread stress
    cs = indicators_raw.get("credit_spread")
    if cs is not None and not cs.empty:
        val = float(cs.iloc[-1])
        # Compute widening from 12-month low
        low_1y = float(cs.tail(252).min()) if len(cs) >= 252 else float(cs.min())
        widening = val - low_1y
        alerts["credit_spread"] = {
            "name": "HY Credit Spread (OAS)",
            "value": round(val, 4),
            "one_year_low": round(low_1y, 4),
            "widening_from_low": round(widening, 4),
            "warning_threshold": 3.0,
            "warning_widening_threshold": 3.0,
            "level_triggered": val >= 5.0,
            "widening_triggered": widening >= 3.0,
            "interpretation": (
                "STRESS — spread above 500bps" if val >= 5.0
                else "WARNING — widened 300bps+ from low" if widening >= 3.0
                else "normal"
            ),
            "source": f"{FRED_BASE_URL}BAMLH0A0HYM2",
        }

    # VIX
    vx = indicators_raw.get("vix")
    if vx is not None and not vx.empty:
        val = float(vx.iloc[-1])
        alerts["vix"] = {
            "name": "VIX (Implied Volatility)",
            "value": round(val, 2),
            "thresholds": {"elevated": 25, "high_fear": 30, "panic": 40},
            "triggered_level": (
                "panic" if val >= 40 else "high_fear" if val >= 30
                else "elevated" if val >= 25 else "normal"
            ),
            "source": f"{FRED_BASE_URL}VIXCLS",
        }

    # Sahm Rule
    sr = indicators_raw.get("sahm_rule")
    if sr is not None and not sr.empty:
        val = float(sr.iloc[-1])
        alerts["sahm_rule"] = {
            "name": "Sahm Rule Recession Indicator",
            "value": round(val, 4),
            "threshold": 0.5,
            "triggered": val >= 0.5,
            "interpretation": "RECESSION SIGNAL" if val >= 0.5 else "no recession signal",
            "source": f"{FRED_BASE_URL}SAHMREALTIME",
        }

    # Oil — year-over-year change
    oil = indicators_raw.get("oil_wti")
    if oil is not None and not oil.empty and len(oil) >= 252:
        current_oil = float(oil.iloc[-1])
        year_ago = float(oil.iloc[-252])
        yoy = ((current_oil - year_ago) / year_ago) * 100
        alerts["oil_yoy"] = {
            "name": "WTI Oil Year-over-Year Change",
            "current_price": round(current_oil, 2),
            "year_ago_price": round(year_ago, 2),
            "yoy_pct": round(yoy, 2),
            "warning_threshold_pct": 80,
            "triggered": yoy >= 80,
            "interpretation": (
                "DANGER — oil doubled YoY (Hamilton recession signal)" if yoy >= 100
                else "WARNING — rapid oil price increase" if yoy >= 80
                else "elevated" if yoy >= 50
                else "normal"
            ),
            "reference": "Hamilton (1983, 2009): rapid oil price doublings precede recessions",
            "source": f"{FRED_BASE_URL}DCOILWTICO",
        }

    return alerts


def determine_stage(bonds_signal: str, equities_signal: str, commodities_signal: str) -> dict:
    """Determine Pring's cycle stage from 3 barometer signals."""
    key = (bonds_signal, equities_signal, commodities_signal)
    if key in STAGE_MAP:
        stage_num, stage_label = STAGE_MAP[key]
    else:
        stage_num, stage_label = None, "Indeterminate"

    return {
        "stage": stage_num,
        "label": stage_label,
        "bonds": bonds_signal,
        "equities": equities_signal,
        "commodities": commodities_signal,
    }


def get_allocation_guidance(stage) -> dict:
    """Pring's recommended allocation tilt for each stage."""
    table = {
        1: {"bonds": "overweight", "equities": "underweight", "commodities": "underweight", "cash": "high",
            "rationale": "Bonds rally as rates fall. Equities still declining. Hold cash until equity barometer turns."},
        2: {"bonds": "overweight", "equities": "overweight",  "commodities": "underweight", "cash": "reduce",
            "rationale": "Both bonds and equities rising — the sweet spot. Deploy cash into risk assets."},
        3: {"bonds": "underweight","equities": "overweight",  "commodities": "overweight",  "cash": "low",
            "rationale": "Bonds falling as rates rise. Equities and commodities benefit from expansion."},
        4: {"bonds": "underweight","equities": "neutral",     "commodities": "overweight",  "cash": "low",
            "rationale": "Equities topping, commodities still strong. Watch for equity weakness."},
        5: {"bonds": "underweight","equities": "underweight", "commodities": "neutral",     "cash": "raise",
            "rationale": "Equities falling, commodities topping. Raise cash. Defensive positioning."},
        6: {"bonds": "neutral",   "equities": "underweight",  "commodities": "underweight", "cash": "maximum",
            "rationale": "Everything falling. Maximum cash. Wait for bond barometer to turn up (Stage 1)."},
    }
    return table.get(stage, {"bonds": "n/a", "equities": "n/a", "commodities": "n/a", "cash": "n/a",
                              "rationale": "Cannot determine — barometer combination does not match a standard Pring stage."})


def compute_historical_stages(raw_data: dict) -> list:
    """
    Backtest the stage logic since 2007 by calculating historical 200d MAs
    for Bonds, Equities, and Commodities. Outputs a weekly time series.
    """
    bonds = raw_data.get("treasury_10y")
    equities = raw_data.get("sp500")
    commodities = raw_data.get("commodity_djp")

    if bonds is None or equities is None or commodities is None:
        return []

    # Combine into a single dataframe, forward-fill missing days
    df = pd.DataFrame({
        "bonds": bonds,
        "equities": equities,
        "commodities": commodities
    }).ffill().dropna()

    # Calculate moving averages
    df["bonds_ma"] = df["bonds"].rolling(window=MA_PERIOD_DAYS, min_periods=int(MA_PERIOD_DAYS * 0.8)).mean()
    df["equities_ma"] = df["equities"].rolling(window=MA_PERIOD_DAYS, min_periods=int(MA_PERIOD_DAYS * 0.8)).mean()
    df["commodities_ma"] = df["commodities"].rolling(window=MA_PERIOD_DAYS, min_periods=int(MA_PERIOD_DAYS * 0.8)).mean()

    # Drop early rows without MAs and filter from 2007 onwards
    df = df.dropna()
    df = df[df.index >= "2007-01-01"]

    # Resample to weekly (Fridays) to keep the JSON small but granular
    df = df.resample("W-FRI").last().dropna()

    history = []
    for date, row in df.iterrows():
        # Remember: Bonds are inverted (yield > MA means price is falling)
        b_sig = "falling" if row["bonds"] > row["bonds_ma"] else "rising"
        e_sig = "rising" if row["equities"] > row["equities_ma"] else "falling"
        c_sig = "rising" if row["commodities"] > row["commodities_ma"] else "falling"

        key = (b_sig, e_sig, c_sig)
        stage_num, _ = STAGE_MAP.get(key, (None, "Indeterminate"))

        if stage_num is not None:
            history.append({
                "date": date.strftime("%Y-%m-%d"),
                "stage": stage_num,
                "bonds": b_sig,
                "equities": e_sig,
                "commodities": c_sig
            })

    return history


# ---------------------------------------------------------------------------
# History tracking
# ---------------------------------------------------------------------------

def update_history(history_path: Path, stage_info: dict) -> list:
    """Load history.json, append if stage changed, return updated history."""
    history = []
    if history_path.exists():
        try:
            with open(history_path, "r") as f:
                history = json.load(f)
        except (json.JSONDecodeError, IOError):
            history = []

    current_stage = stage_info["stage"]
    today = datetime.utcnow().strftime("%Y-%m-%d")

    # Only append if stage changed or history is empty
    if not history or history[-1]["stage"] != current_stage:
        history.append({
            "date": today,
            "stage": current_stage,
            "label": stage_info["label"],
            "bonds": stage_info["bonds"],
            "equities": stage_info["equities"],
            "commodities": stage_info["commodities"],
        })

    return history


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("CYCLE DASHBOARD — DATA PIPELINE v2")
    print(f"Run: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print("=" * 60)

    fred_api_key = os.environ.get("FRED_API_KEY")
    if not fred_api_key:
        print("\nERROR: FRED_API_KEY not set.")
        print("Get a free key: https://fred.stlouisfed.org/docs/api/api_key.html")
        sys.exit(1)

    from fredapi import Fred
    fred = Fred(api_key=fred_api_key)

    base_dir = Path(__file__).parent.parent
    series_dir = base_dir / "data" / "series"
    series_dir.mkdir(parents=True, exist_ok=True)

    # ---- Fetch & write raw series ----
    print("\nFetching data...")

    raw_data = {}

    # FRED series
    for key, meta in FRED_SERIES.items():
        print(f"  FRED/{meta['id']} ({meta['name']})...")
        series = fetch_fred(fred, meta["id"])
        raw_data[key] = series
        if not series.empty:
            out = series_to_json(series, meta, f"{FRED_BASE_URL}{meta['id']}")
            with open(series_dir / f"{key}.json", "w") as f:
                json.dump(out, f, indent=2)
            print(f"    -> {len(series)} points, latest: {series.index[-1].strftime('%Y-%m-%d')} = {series.iloc[-1]:.4f}")

    # Yahoo series
    for key, meta in YAHOO_SERIES.items():
        print(f"  Yahoo/{meta['ticker']} ({meta['name']})...")
        series = fetch_yahoo(meta["ticker"])
        raw_data[key] = series
        if not series.empty:
            source_url = f"https://finance.yahoo.com/quote/{meta['ticker'].replace('^', '%5E')}/"
            out = series_to_json(series, meta, source_url)
            with open(series_dir / f"{key}.json", "w") as f:
                json.dump(out, f, indent=2)
            print(f"    -> {len(series)} points, latest: {series.index[-1].strftime('%Y-%m-%d')} = {series.iloc[-1]:.4f}")

    # ---- Compute barometers ----
    print("\nComputing barometers...")

    bonds = compute_barometer(
        raw_data.get("treasury_10y", pd.Series(dtype=float)),
        "Bond Barometer (10Y Treasury Yield)",
        invert=True,
        invert_reason="Yields are inverse to bond prices. Yield above MA = bond prices falling.",
    )
    print(f"  Bonds:       {bonds['signal'].upper()} (yield {bonds.get('current', '?')} vs MA {bonds.get('ma_200d', '?')})")

    equities = compute_barometer(
        raw_data.get("sp500", pd.Series(dtype=float)),
        "Equity Barometer (S&P 500)",
    )
    print(f"  Equities:    {equities['signal'].upper()} (price {equities.get('current', '?')} vs MA {equities.get('ma_200d', '?')})")

    commodities = compute_barometer(
        raw_data.get("commodity_djp", pd.Series(dtype=float)),
        "Commodity Barometer (DJP)",
    )
    print(f"  Commodities: {commodities['signal'].upper()} (price {commodities.get('current', '?')} vs MA {commodities.get('ma_200d', '?')})")

    # ---- Determine stage ----
    stage_info = determine_stage(
        bonds.get("signal", "unknown"),
        equities.get("signal", "unknown"),
        commodities.get("signal", "unknown"),
    )
    print(f"\n  -> Stage {stage_info['stage']}: {stage_info['label']}")

    # ---- Threshold alerts ----
    print("\nComputing threshold alerts...")
    alerts = compute_thresholds(raw_data)
    for key, alert in alerts.items():
        triggered = alert.get("triggered") or alert.get("level_triggered") or alert.get("widening_triggered")
        flag = "TRIGGERED" if triggered else "ok"
        val = alert.get("value", alert.get("current_price", "?"))
        print(f"  {alert['name']}: {val} [{flag}]")

    # ---- Macro Indicators ----
    print("\nComputing Pring's true macro indicators...")
    macro_indicators = compute_macro_indicators(raw_data)
    for key, mac in macro_indicators.items():
        print(f"  {mac['name']}: {mac['value']} ({mac['signal']})")

    # ---- Allocation guidance ----
    allocation = get_allocation_guidance(stage_info["stage"])

    # ---- Write indicators.json ----
    indicators = {
        "computed_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ma_period": {"days": MA_PERIOD_DAYS, "label": MA_PERIOD_LABEL},
        "barometers": {
            "bonds": bonds,
            "equities": equities,
            "commodities": commodities,
        },
        "stage": stage_info,
        "allocation": allocation,
        "threshold_alerts": alerts,
        "macro_indicators": macro_indicators,
        "stage_reference": {
            "1": {"label": "Late Recession",  "bonds": "rising",  "equities": "falling", "commodities": "falling"},
            "2": {"label": "Early Recovery",   "bonds": "rising",  "equities": "rising",  "commodities": "falling"},
            "3": {"label": "Mid Expansion",    "bonds": "falling", "equities": "rising",  "commodities": "rising"},
            "4": {"label": "Late Expansion",   "bonds": "falling", "equities": "rising",  "commodities": "falling"},
            "5": {"label": "Early Downturn",   "bonds": "falling", "equities": "falling", "commodities": "rising"},
            "6": {"label": "Full Recession",   "bonds": "falling", "equities": "falling", "commodities": "falling"},
        },
        "data_sources": {
            "bonds": f"{FRED_BASE_URL}DGS10",
            "equities": "https://finance.yahoo.com/quote/%5EGSPC/",
            "commodities": "https://finance.yahoo.com/quote/DJP/",
            "yield_curve": f"{FRED_BASE_URL}T10Y2Y",
            "credit_spread": f"{FRED_BASE_URL}BAMLH0A0HYM2",
            "vix": f"{FRED_BASE_URL}VIXCLS",
            "sahm_rule": f"{FRED_BASE_URL}SAHMREALTIME",
            "oil": f"{FRED_BASE_URL}DCOILWTICO",
            "ism_pmi": "https://www.ismworld.org/ (manual — not freely available on FRED)",
        },
        "model_reference": "Martin Pring, 'The Investor's Guide to Active Asset Allocation' (2006)",
    }

    indicators_path = base_dir / "data" / "indicators.json"
    with open(indicators_path, "w") as f:
        json.dump(indicators, f, indent=2)
    print(f"\nWrote: {indicators_path} ({indicators_path.stat().st_size:,} bytes)")

    # ---- Update history ----
    history_path = base_dir / "data" / "history.json"
    history = update_history(history_path, stage_info)
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)
    print(f"Wrote: {history_path} ({len(history)} entries)")

    # ---- Historical backtest ----
    print("\nComputing historical stages backtest since 2007...")
    hist_stages = compute_historical_stages(raw_data)
    hist_path = base_dir / "data" / "historical_stages.json"
    with open(hist_path, "w") as f:
        json.dump(hist_stages, f, indent=2)
    print(f"Wrote: {hist_path} ({len(hist_stages)} weekly entries)")

    # ---- Write meta.json ----
    meta = {
        "project": "Cycle Dashboard",
        "description": "Pring's 6-Stage Business Cycle Model with live market data",
        "repository": "https://github.com/lzcai-prod/cycle-dashboard",
        "updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "series_files": sorted([f.name for f in series_dir.glob("*.json")]),
    }
    meta_path = base_dir / "data" / "meta.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    # ---- Summary ----
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Stage {stage_info['stage']}: {stage_info['label']}")
    print(f"  Bonds:       {bonds.get('signal', '?').upper():>8}  ({bonds.get('pct_from_ma', '?')}% from MA)")
    print(f"  Equities:    {equities.get('signal', '?').upper():>8}  ({equities.get('pct_from_ma', '?')}% from MA)")
    print(f"  Commodities: {commodities.get('signal', '?').upper():>8}  ({commodities.get('pct_from_ma', '?')}% from MA)")
    print(f"\n  Allocation: bonds={allocation['bonds']}, equities={allocation['equities']}, "
          f"commodities={allocation['commodities']}, cash={allocation['cash']}")
    print(f"  Rationale: {allocation['rationale']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
