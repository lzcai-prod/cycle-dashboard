# Cycle Dashboard

**Live business cycle stage tracking using Martin Pring's 6-stage model.**

This project fetches real-time market data and transparently computes which stage of the business cycle we're in, based on the framework from Pring's *"The Investor's Guide to Active Asset Allocation"* (2006).

**Every signal is derived from raw data — nothing is hardcoded.** The output JSON shows every calculation step so you can verify the logic yourself.

## Pring's 6-Stage Business Cycle Model

The model uses 3 "barometers" — bonds, equities, and commodities — each classified as RISING or FALLING based on whether the current value is above or below its 200-day moving average.

| Stage | Economy | Bonds | Equities | Commodities | Cash Allocation |
|-------|---------|-------|----------|-------------|----------------|
| 1 | Late Recession | ↑ Rising | ↓ Falling | ↓ Falling | High |
| 2 | Early Recovery | ↑ Rising | ↑ Rising | ↓ Falling | Reduce |
| 3 | Mid Expansion | ↓ Falling | ↑ Rising | ↑ Rising | Low |
| 4 | Late Expansion | ↓ Falling | ↑ Rising | ↑ Rising | Low |
| 5 | Early Downturn | ↓ Falling | ↓ Falling | ↑ Rising | Raise |
| 6 | Full Recession | ↓ Falling | ↓ Falling | ↓ Falling | Maximum |

**Key insight:** Bond barometer uses the 10Y Treasury yield *inverted* — rising yields mean falling bond prices.

## How It Works

1. **Fetch** raw data from FRED API (St. Louis Fed) and Yahoo Finance
2. **Compute** 200-day moving average for each barometer
3. **Compare** current value vs. MA to determine UP/DOWN signal
4. **Map** the 3-signal combination to a Pring cycle stage
5. **Output** everything to `data/latest.json` with full calculation chain

The JSON output includes:
- Raw values and MA values
- Percent difference from MA
- Signal derivation logic (in plain English)
- Data source URLs for every series
- Supporting indicators (yield curve, credit spreads, VIX, Sahm Rule, oil)

## Data Sources (all free, all public)

| Indicator | Source | Series ID | URL |
|-----------|--------|-----------|-----|
| 10Y Treasury Yield | FRED | DGS10 | [Link](https://fred.stlouisfed.org/series/DGS10) |
| S&P 500 | Yahoo Finance | ^GSPC | [Link](https://finance.yahoo.com/quote/%5EGSPC/) |
| Commodity Proxy | Yahoo Finance | DJP | [Link](https://finance.yahoo.com/quote/DJP/) |
| Yield Curve (10Y-2Y) | FRED | T10Y2Y | [Link](https://fred.stlouisfed.org/series/T10Y2Y) |
| HY Credit Spread | FRED | BAMLH0A0HYM2 | [Link](https://fred.stlouisfed.org/series/BAMLH0A0HYM2) |
| VIX | FRED | VIXCLS | [Link](https://fred.stlouisfed.org/series/VIXCLS) |
| Sahm Rule | FRED | SAHMREALTIME | [Link](https://fred.stlouisfed.org/series/SAHMREALTIME) |
| WTI Oil | FRED | DCOILWTICO | [Link](https://fred.stlouisfed.org/series/DCOILWTICO) |
| ISM PMI | ISM (manual) | — | [Link](https://www.ismworld.org/) |

## Run Locally

```bash
# 1. Get a free FRED API key: https://fred.stlouisfed.org/docs/api/api_key.html

# 2. Install dependencies
pip install -r scripts/requirements.txt

# 3. Run the pipeline
FRED_API_KEY=your_key_here python scripts/fetch_data.py

# 4. Check the output
cat data/latest.json
```

## GitHub Actions (Automated Updates)

The workflow at `.github/workflows/update-data.yml` runs every weekday at 6 AM UTC:
1. Fetches latest market data
2. Computes all signals
3. Commits updated `data/latest.json` back to the repo

**Setup:** Add your FRED API key as a repository secret named `FRED_API_KEY`.

## Output Structure

```
data/latest.json
├── _metadata           # Sources, methodology, timestamps
├── current_stage       # Stage number, label, allocation guidance
│   ├── determination_logic   # Shows exactly how stage was determined
│   ├── stage_reference       # All 6 stages for context
│   └── allocation_guidance   # Pring's recommended tilts
├── barometers
│   ├── bonds           # 10Y yield → inverted → bond signal
│   │   ├── calculation_steps  # raw_value, ma_value, pct_diff, signal_logic
│   │   └── signal             # "rising" or "falling"
│   ├── equities        # S&P 500 → direct comparison
│   └── commodities     # DJP/PPIACO → direct comparison
└── supporting_indicators
    ├── yield_curve     # With inversion threshold check
    ├── credit_spread   # With 500bps/800bps warning levels
    ├── vix             # With 25/30/40 threshold levels
    ├── sahm_rule       # With 0.5pp recession trigger
    ├── oil_wti         # With YoY change calculation
    └── ism_pmi         # Manual input (not on FRED)
```

## Research & References

- **Pring, M.** (2006). *The Investor's Guide to Active Asset Allocation.* McGraw-Hill.
- **Faber, M.** (2007). [A Quantitative Approach to Tactical Asset Allocation](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=962461). SSRN.
- **Hansen, A.L.** (2021). [Predicting Recessions Using VIX-Yield-Curve Cycles](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3943982). SSRN.
- **Hamilton, J.** (1983). Oil and the Macroeconomy since World War II. *Journal of Political Economy.*
- **Estrella, A. & Mishkin, F.** (1998). Predicting U.S. Recessions. *NY Fed.*
- **Sahm, C.** (2019). Direct Stimulus Payments to Individuals. *Hamilton Project / Brookings.*

## License

MIT
