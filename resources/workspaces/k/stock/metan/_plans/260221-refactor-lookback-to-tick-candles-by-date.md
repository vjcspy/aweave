# 260221-Refactor-Lookback-To-Tick-Candles-By-Date

## References

- `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/stock_data_collector/stock_data_collector.py`
- `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/calculator/common/base.py`
- `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/calculator/base_feature_calculator.py`
- `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/calculator/whale_footprint/whale_footprint_feature_calculator.py`
- `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/persistor/intraday/intraday_symbol_feature_persistor.py`
- `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/persistor/vn30/vn30_feature_pipeline.py`
- `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/index/tick_vn30_index_calculator.py`
- `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/index/vn30_base_calculator.py`
- `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/index/tcbs_vn30_index_calculator.py`
- `resources/workspaces/k/stock/metan/_plans/260102-explicit-lookback-days-stock-data-collector.md` (previous iteration)

## User Requirements

Currently, `StockDataCollector` accepts `lookback_days` as a constructor parameter (default=5). This causes ALL public methods (`ticks()`, `prices()`, `tick_candles_by_date()`, `price_candles_by_date()`) to silently fetch data beyond the requested `[start_date, end_date]` range via `_effective_start_date()`. A caller using `ticks()` expects data exactly from `start_date` to `end_date`, not an extended range.

The previous plan (260102) moved lookback from a hardcoded magic number to an explicit constructor param. This iteration goes further: remove `lookback_days` from the constructor entirely and place it only where it's actually needed — `tick_candles_by_date()`.

## Objective

Refactor `StockDataCollector` so that:

1. The constructor has no `lookback_days` — the class is a pure data accessor.
2. `ticks()` and `prices()` always return exactly `[start_date, end_date]` — no surprises.
3. `lookback_days` moves to `tick_candles_by_date(lookback_days=0)` — the only method that actually needs the extended range for feature calculations.
4. `price_candles_by_date()` uses `start_date` directly — no implicit extension.
5. Caching remains correct across different lookback values on the same instance.

### Key Considerations

1. **`_effective_start_date()` is shared across 3 methods** — `ticks()`, `prices()`, `tick_candles_by_date()` all use it today. We need to disentangle this by extracting internal fetch helpers and parameterizing the lookback resolution.
2. **`tick_candles_by_date()` orchestrates `ticks()` + `prices()` internally** — it must call them with the extended range without exposing that to the public API. Solution: internal `_fetch_ticks(start, end)` and `_fetch_prices(start, end)` methods.
3. **Single-value cache `_start_date_to_fetch` must go** — it can only store one resolved date, but now different methods need different date ranges. Replace with per-key caching.
4. **The lookback DB logic stays inside `StockDataCollector`** — computing "N trading days before X" requires querying `stock_info_prices` to find actual trading days. This is data-layer responsibility, not caller responsibility.
5. **No callers currently pass `lookback_days` explicitly** — all use the default. Removing from constructor is safe.
6. **Feature callers must explicitly opt in** — `tick_candles_by_date(lookback_days=FEATURE_ROLLING_WINDOW_DAYS)` makes the intent clear at the call site.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Confirm no caller passes `lookback_days` explicitly to the constructor
  - **Outcome**: Grep confirms all callers use `StockDataCollector(symbol, start_date, end_date, interval)` — no explicit `lookback_days`
- [x] Map all `_effective_start_date()` call sites and their actual lookback needs
  - **Outcome**:

    | Call Site | Needs Lookback? |
    |-----------|-----------------|
    | `ticks()` line 141 | No — should return exact range |
    | `prices()` line 352 | No — should return exact range |
    | `tick_candles_by_date()` (via `ticks()` + `prices()`) | Yes — for feature rolling window |
    | `price_candles_by_date()` line 415 | No — TCBS data, no feature dependency |

### Phase 2: Implementation Structure

```
workspaces/k/stock/metan/packages/stock/metan/stock/
├── info/domain/stock_data_collector/
│   └── stock_data_collector.py               # 🔄 Major refactor
├── trading/domain/feature/
│   ├── calculator/
│   │   ├── common/base.py                    # ✅ No change (FEATURE_ROLLING_WINDOW_DAYS already defined)
│   │   ├── base_feature_calculator.py        # ✅ No change (constructor call drops lookback_days naturally)
│   │   └── whale_footprint/
│   │       └── whale_footprint_feature_calculator.py  # 🔄 Pass lookback_days to tick_candles_by_date()
│   └── persistor/
│       ├── intraday/
│       │   └── intraday_symbol_feature_persistor.py   # ✅ No change (uses default lookback_days=0)
│       └── vn30/
│           └── vn30_feature_pipeline.py               # ✅ No change (uses default lookback_days=0)
├── info/domain/index/
│   ├── tick_vn30_index_calculator.py         # ✅ No change (uses default lookback_days=0)
│   ├── vn30_base_calculator.py               # ✅ No change (uses default lookback_days=0)
│   └── tcbs_vn30_index_calculator.py         # ✅ No change (uses price_candles_by_date)
└── testbed/
    └── compare_candle.py                     # ✅ No change (uses price_candles_by_date)
```

### Phase 3: Detailed Implementation Steps

#### Step 1: Refactor `StockDataCollector` — Constructor and Cache

Remove `lookback_days` from constructor. Remove `_start_date_to_fetch`. Add `lookback_start` cache namespace.

```python
# stock_data_collector.py

def __init__(
    self,
    symbol: str,
    start_date: str,
    end_date: str,
    interval: IntradayInterval,
):
    self.symbol = symbol
    self.start_date = start_date
    self.end_date = end_date
    self.interval = interval
    self._cached_data: dict[str, dict[str, object]] = {
        "ticks": {},
        "tick_candles": {},
        "tick_candles_by_date": {},
        "price_candles_by_date": {},
        "stock": {},
        "prices": {},
        "lookback_start": {},  # NEW: cache resolved lookback dates
    }
    self._logger.info(f"[{self._ctx()}] init StockDataCollector")

def _ctx(self) -> str:
    return f"{self.symbol}|{self.start_date}->{self.end_date}|{int(self.interval)}s"
```

#### Step 2: Rename `_effective_start_date()` to `_resolve_lookback_start(lookback_days)`

Parameterize the lookback logic. Cache by `lookback_days` value.

```python
def _resolve_lookback_start(self, lookback_days: int) -> str:
    cache_key = f"{self.symbol}|{self.end_date}|{lookback_days}"
    cached = self._cached_data["lookback_start"].get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    if lookback_days == 0:
        self._cached_data["lookback_start"][cache_key] = self.start_date
        return self.start_date

    # Count rows in [start_date, end_date]
    count_resp = (
        supabase.table("stock_info_prices")
        .select("id", count=cast(Any, "exact"))
        .eq("symbol", self.symbol)
        .gte("date", self.start_date)
        .lte("date", self.end_date)
        .execute()
    )
    count_val = count_resp.count
    if count_val == 0:
        raise ValueError(...)

    desired_limit = int(count_val or 0) + lookback_days
    # ... rest of existing logic, store result in cache
    self._cached_data["lookback_start"][cache_key] = resolved_date
    return resolved_date
```

#### Step 3: Extract `_fetch_ticks(start_date, end_date)` and `_fetch_prices(start_date, end_date)`

Move the DB query and parsing logic from `ticks()` and `prices()` into internal methods that accept explicit dates. Cache by actual dates.

**Exception behavior:** Both `_fetch_ticks()` and `_fetch_prices()` MUST retain the original `ValueError` raising behavior when no data is found for the requested range. They do not return empty lists silently — downstream logic in `tick_candles_by_date()` depends on data being present.

```python
def _fetch_ticks(self, start_date: str, end_date: str) -> list[Tick]:
    cache_key = f"{self.symbol}|{start_date}|{end_date}"
    cached = self._cached_data["ticks"].get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]
    # ... existing ticks() fetch + parse logic using start_date/end_date params
    # Raises ValueError if no data found (same as current ticks() behavior)
    self._cached_data["ticks"][cache_key] = parsed
    return parsed

def _fetch_prices(self, start_date: str, end_date: str) -> list[Price]:
    cache_key = f"{self.symbol}|{start_date}|{end_date}"
    cached = self._cached_data["prices"].get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]
    # ... existing prices() fetch + parse logic using start_date/end_date params
    # Raises ValueError if no data found (same as current prices() behavior)
    self._cached_data["prices"][cache_key] = parsed
    return parsed
```

#### Step 4: Refactor `ticks()` and `prices()` as thin wrappers

These become clean public APIs that always return `[start_date, end_date]`.

```python
def ticks(self) -> list[Tick]:
    return self._fetch_ticks(self.start_date, self.end_date)

def prices(self) -> list[Price]:
    return self._fetch_prices(self.start_date, self.end_date)
```

#### Step 5: Add `lookback_days` param to `tick_candles_by_date()`

This is the only method that needs the extended range.

```python
def tick_candles_by_date(self, lookback_days: int = 0) -> dict[str, list[TickCandle]]:
    cache_key = f"{self.symbol}|{self.start_date}|{self.end_date}|{int(self.interval)}|{lookback_days}"
    cached = self._cached_data["tick_candles_by_date"].get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    effective_start = (
        self._resolve_lookback_start(lookback_days) if lookback_days > 0 else self.start_date
    )

    ticks = self._fetch_ticks(effective_start, self.end_date)
    # ... existing candle-building logic ...

    # prices() for fallback — also needs extended range
    daily_prices = self._fetch_prices(effective_start, self.end_date)
    prices_map = {p.date: p for p in daily_prices}

    # ... rest of existing logic (unchanged) ...
    self._cached_data["tick_candles_by_date"][cache_key] = result
    return result
```

#### Step 6: Refactor `price_candles_by_date()` to use `self.start_date` directly

Remove dependency on `_effective_start_date()`.

```python
def price_candles_by_date(self) -> dict[str, list[PriceCandle]]:
    cache_key = f"{self.symbol}|{self.start_date}|{self.end_date}|{int(self.interval)}"
    # ...
    fetcher = TcbsSymbolCandleFetcher(
        symbol=self.symbol,
        start_date=self.start_date,  # Was: self._effective_start_date()
        end_date=self.end_date,
        interval=self.interval,
    )
    # ... rest unchanged
```

#### Step 7: Update feature calculator to pass `lookback_days`

Only the feature calculator itself — the domain layer that owns the lookback requirement — passes `lookback_days`. Infrastructure orchestrators (`IntradaySymbolFeaturePersistor`, `VN30FeaturePipeline`) remain generic and use the default `lookback_days=0`.

**`whale_footprint_feature_calculator.py`** line 80:

```python
from metan.stock.trading.domain.feature.calculator.common.base import FEATURE_ROLLING_WINDOW_DAYS

# In _cal_candle_features():
tick_candles_by_date = self.data_collector.tick_candles_by_date(
    lookback_days=FEATURE_ROLLING_WINDOW_DAYS
)
```

**`intraday_symbol_feature_persistor.py`** — NO CHANGE:

- `_build_base_candles()` calls `collector.tick_candles_by_date()` with default `lookback_days=0`
- It already filters to `[start_date, end_date]` at line 97, so it only needs data in the requested range
- The feature calculator handles its own lookback independently when `calc.cal()` is called

**`vn30_feature_pipeline.py`** — NO CHANGE:

- `_prefetch_symbol()` calls `collector.tick_candles_by_date()` with default `lookback_days=0`
- Prefetched data is used for index calculation (which does not need lookback)
- When `WhaleFootprintFeatureCalculator` runs on the same collector, it calls `tick_candles_by_date(lookback_days=5)` separately — this is a different cache entry and triggers its own Supabase query

**Trade-off:** This means two Supabase queries for ticks per symbol (one for `[start_date, end_date]`, one for `[effective_start, end_date]`). This is acceptable: correctness and separation of concerns outweigh the caching optimization. The orchestrator should not know about feature-specific lookback requirements. If a future feature needs a different lookback window (e.g., 26 days for MACD), no orchestrator changes are needed.

#### Step 8: Verify non-feature callers require no changes

These callers use `tick_candles_by_date()` without lookback — they work with default `lookback_days=0`:

- `tick_vn30_index_calculator.py` line 221: `collector.tick_candles_by_date()` — index only, no lookback needed
- `vn30_base_calculator.py` line 215: `collector.tick_candles_by_date()` — base date only, no lookback needed
- `tcbs_vn30_index_calculator.py` line 207: `collector.price_candles_by_date()` — not affected
- `compare_candle.py` line 15: `collector.price_candles_by_date()` — not affected

### Caller Impact Summary

| Caller | Method Used | Lookback Change | Action |
|--------|-------------|-----------------|--------|
| `WhaleFootprintFeatureCalculator` | `tick_candles_by_date()` | `lookback_days=FEATURE_ROLLING_WINDOW_DAYS` | **Update call** |
| `IntradaySymbolFeaturePersistor._build_base_candles` | `tick_candles_by_date()` | Default (0) | No change — filters to `[start, end]` already |
| `VN30FeaturePipeline._prefetch_symbol` | `tick_candles_by_date()` | Default (0) | No change — index calculation doesn't need lookback |
| `TickVN30IndexCalculator` | `tick_candles_by_date()` | Default (0) | No change |
| `VN30BaseCalculator` | `tick_candles_by_date()` | Default (0) | No change |
| `TcbsVN30IndexCalculator` | `price_candles_by_date()` | N/A | No change |
| `BaseFeatureCalculator` | Constructor only | N/A | Drops `lookback_days` naturally |
| `VN30WhaleFootprintAggregator` | Delegates to `WhaleFootprintFeatureCalculator` | N/A | No direct change |
| `compare_candle.py` | `price_candles_by_date()` | N/A | No change |

Only **one file** (`whale_footprint_feature_calculator.py`) needs a code change to pass `lookback_days`. All orchestrators and index calculators work with the default.

### Cache Strategy After Refactor

| Cache Namespace | Key Pattern | Notes |
|-----------------|-------------|-------|
| `ticks` | `{symbol}\|{start}\|{end}` | Keyed by actual dates (not self.start_date) |
| `prices` | `{symbol}\|{start}\|{end}` | Keyed by actual dates |
| `tick_candles_by_date` | `{symbol}\|{start}\|{end}\|{interval}\|{lookback}` | Includes lookback to differentiate |
| `price_candles_by_date` | `{symbol}\|{start}\|{end}\|{interval}` | No lookback dimension |
| `stock` | `{symbol}` | Unchanged |
| `lookback_start` | `{symbol}\|{end}\|{lookback}` | Caches resolved lookback date |

Two calls with different `lookback_days` on the same instance produce separate cache entries — no conflicts.

## Summary of Results

### Completed Achievements

- Removed `lookback_days` from `StockDataCollector` constructor to simplify instantiation.
- Enhanced `_fetch_ticks` and `_fetch_prices` internals and exposed wrapper methods `ticks()` and `prices()` that return requested ranges strictly.
- Refactored lookup back logic using `_resolve_lookback_start(lookback_days)` with a cached namespace.
- Added explicit `lookback_days` parameter on `tick_candles_by_date` and enabled caller-specific lookback windows.
- Updated `whale_footprint_feature_calculator.py` to correctly define its required `FEATURE_ROLLING_WINDOW_DAYS`.

## Outstanding Issues & Follow-up

- [x] Update `resources/workspaces/k/stock/metan/OVERVIEW.md` to reflect the new `tick_candles_by_date(lookback_days)` API and removal of `lookback_days` from constructor
- [ ] Consider whether `FEATURE_ROLLING_WINDOW_DAYS` should be configurable per feature calculator (currently all use 5)

## Implementation Notes / As Implemented

Implemented the refactor successfully. `StockDataCollector` class correctly respects strict date ranges now outside of `tick_candles_by_date`, removing implicit behavior. Documentation is updated. Syntax checks out.
