# 260218: Optimize VN30 Pipeline - Shared Data Layer & Parallel Processing

> **Status:** ✅ IMPLEMENTED
> **Date:** 2026-02-18

## References

- Overview: `resources/workspaces/k/stock/metan/OVERVIEW.md`
- Pipeline: `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/persistor/vn30/vn30_feature_pipeline.py`
- Symbol Persistor: `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/persistor/intraday/intraday_symbol_feature_persistor.py`
- Index Calculator: `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/index/tick_vn30_index_calculator.py`
- Aggregator: `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/aggregator/vn30/vn30_whale_footprint_aggregator.py`
- StockDataCollector: `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/stock_data_collector/stock_data_collector.py`

## Objective

Optimize `VN30FeaturePipeline` performance by:

1. **Eliminating redundant Supabase fetches** — Currently 120 calls where 60 are redundant (tick_candles fetched 2×, stock info fetched 2×)
2. **Parallelizing per-symbol processing** — Currently 30 symbols processed sequentially (~4-8 min), target ~1-2 min with ThreadPoolExecutor

### Key Considerations

| Consideration | Detail |
|---|---|
| **Backward compatibility** | All interface changes must be additive (optional parameters). Existing callers must work unchanged. |
| **Supabase rate limits** | ThreadPoolExecutor `max_workers` must be tunable. Default 6 to avoid connection exhaustion. |
| **Thread safety** | `StockDataCollector._cached_data` is currently **class-level** (shared across all instances). Must be moved to **instance-level** before parallel execution. Each symbol then uses its own collector instance with isolated cache. |
| **Memory** | Pre-fetching all 30 symbols' data into memory. ~60 candles/day × 30 symbols × N days — estimated 50-100MB for typical ranges. Acceptable. |
| **Error isolation** | Per-future try/except collects errors without crashing threads. However, both prefetch and feature steps abort the pipeline if any symbol fails (`errors > 0` → `ValueError`), because downstream index calculation and aggregation require all 30 symbols to be complete. |
| **Interval constraint** | `TickVN30IndexCalculator` hardcodes `FIVE_MINUTES`. Pipeline must enforce this with a guard clause rather than silently diverge. |

### Current Data Fetch Map (Redundancies Highlighted)

```
Step 2 (per-symbol features):     30 × tick_candles_by_date()  +  30 × prices()
Step 3 (index calc):              30 × tick_candles_by_date()  +  30 × stock()    ← REDUNDANT ticks
Step 4 (aggregation):             30 × DB features read        +  30 × stock()    ← REDUNDANT stock
                                  ─────────────────────────────────────────────────
Total:                            60 tick fetches (30 redundant) + 60 stock fetches (30 redundant)
```

### Target Architecture

```
VN30FeaturePipeline.run()
│
├── Phase A: Pre-fetch raw data ──── ThreadPoolExecutor(max_workers=6)
│   └── 30 × StockDataCollector (shared instances, created once)
│       ├── .tick_candles_by_date()   ← 30 fetches total (cached in instance)
│       ├── .prices()                 ← 30 fetches total (cached in instance)
│       └── .stock()                  ← 30 fetches total (cached in instance)
│
├── Phase B: Compute per-symbol features ── ThreadPoolExecutor(max_workers=6)
│   └── 30 × IntradaySymbolFeaturePersistor
│       └── receives shared StockDataCollector → uses cache, no refetch
│
├── Phase C: Calculate VN30 index (sequential, cached data)
│   └── TickVN30IndexCalculator
│       └── receives pre-fetched tick_candles_by_symbol + stocks_info
│
├── Phase D: Aggregate features (sequential, DB read for features only)
│   └── VN30WhaleFootprintAggregator
│       └── receives pre-fetched stocks_info → only fetches features from DB
│
└── Phase E: Merge + Persist VN30 (sequential, unchanged)
```

## Implementation Plan

### Phase 0: Fix `StockDataCollector` Cache Thread Safety (Prerequisite)

**File:** `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/stock_data_collector/stock_data_collector.py`

`_cached_data` is currently a **class-level** dict (line 22), shared across all instances. This causes race conditions under concurrent access. Must be moved to instance-level.

- [x] Move `_cached_data` from class attribute to `__init__` (instance attribute)
- [x] Verify no external code relies on cross-instance cache sharing

```python
class StockDataCollector:
    _logger = Logger()

    def __init__(self, symbol: str, start_date: str, end_date: str, interval: IntradayInterval, lookback_days: int = 5):
        self.symbol = symbol
        # ... existing params ...
        self._cached_data: dict[str, dict[str, object]] = {
            "ticks": {},
            "tick_candles": {},
            "tick_candles_by_date": {},
            "price_candles_by_date": {},
            "stock": {},
            "prices": {},
        }
```

**Impact:** Each collector instance now has its own cache. Shared collector instances (passed from pipeline) still benefit from caching within the same instance. Cross-instance cache sharing is eliminated — this is the desired behavior for thread safety.

### Phase 1: Add Optional External Data to Downstream Components

Modify three components to accept pre-fetched data while keeping full backward compatibility.

#### 1a. `IntradaySymbolFeaturePersistor` — accept external `StockDataCollector`

**File:** `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/persistor/intraday/intraday_symbol_feature_persistor.py`

- [x] Add optional `stock_data_collector` parameter to `__init__`
- [x] In `persist()`, use external collector if provided, otherwise create new (current behavior)

```python
def __init__(
    self, symbol: str, start_date: str, end_date: str, interval: IntradayInterval,
    stock_data_collector: StockDataCollector | None = None,  # NEW
):
    # ...
    self._external_collector = stock_data_collector

def persist(self) -> dict[str, Any]:
    stock_data_collector = self._external_collector or StockDataCollector(
        symbol=self.symbol,
        start_date=self.start_date,
        end_date=self.end_date,
        interval=self.interval,
    )
    # ... rest unchanged
```

#### 1b. `TickVN30IndexCalculator` — accept pre-fetched data

**File:** `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/index/tick_vn30_index_calculator.py`

- [x] Add optional `tick_candles_by_symbol` and `stocks_info` parameters to `__init__`
- [x] In `calculate()`, skip fetch steps if data already provided

```python
def __init__(
    self,
    start_date: str,
    end_date: str,
    # ... existing params ...
    tick_candles_by_symbol: dict[str, dict[str, list[TickCandle]]] | None = None,  # NEW
    stocks_info: dict[str, Stock] | None = None,  # NEW
):
    # ...
    self._pre_tick_candles = tick_candles_by_symbol
    self._pre_stocks_info = stocks_info

def calculate(self) -> list[VN30IndexCandle]:
    stocks_info = self._pre_stocks_info or self._fetch_all_stocks_info()
    tick_candles_by_symbol = self._pre_tick_candles or self._fetch_all_symbols_tick_candles()
    # ... rest unchanged
```

#### 1c. `VN30WhaleFootprintAggregator` — accept pre-fetched stocks_info

**File:** `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/aggregator/vn30/vn30_whale_footprint_aggregator.py`

- [x] Add optional `stocks_info` parameter to `__init__`
- [x] In `calculate()`, skip `_fetch_stocks_info()` if data already provided

```python
def __init__(
    self,
    start_date: str,
    end_date: str,
    interval: IntradayInterval = IntradayInterval.FIVE_MINUTES,
    symbols: list[str] | None = None,
    stocks_info: dict[str, Stock] | None = None,  # NEW
):
    # ...
    self._pre_stocks_info = stocks_info

def calculate(self) -> pd.DataFrame:
    # ...
    stocks_info = self._pre_stocks_info or self._fetch_stocks_info()
    # ...
```

#### 1d. Fix hard-coded `30` in aggregator

**File:** `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/aggregator/vn30/vn30_whale_footprint_aggregator.py`

- [x] Line 260: Replace `!= 30` with `!= len(self.symbols)` and fix comment

### Phase 2: Refactor `VN30FeaturePipeline` — Shared Data Layer

**File:** `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/persistor/vn30/vn30_feature_pipeline.py`

- [x] Add `max_workers` parameter to `__init__` (default `6`)
- [x] Add interval guard clause: raise `ValueError` if `interval != FIVE_MINUTES` (since `TickVN30IndexCalculator` hardcodes 5m)
- [x] Add `_prefetch_all_data()` method that creates 30 `StockDataCollector` instances and triggers data loading
- [x] Store shared data as instance attributes: `_collectors`, `_stocks_info`, `_tick_candles_by_symbol`
- [x] Update `run()` to call prefetch first, then pass cached data downstream

```python
def __init__(
    self,
    start_date: str,
    end_date: str,
    interval: IntradayInterval = IntradayInterval.FIVE_MINUTES,
    force_recalculate: bool = False,
    max_workers: int = 6,  # NEW
):
    if interval != IntradayInterval.FIVE_MINUTES:
        raise ValueError(
            f"VN30FeaturePipeline only supports FIVE_MINUTES interval. "
            f"Got: {interval}. TickVN30IndexCalculator requires 5m intervals."
        )
    # ...
    self.max_workers = max_workers
    self._collectors: dict[str, StockDataCollector] = {}
    self._stocks_info: dict[str, Stock] = {}
    self._tick_candles_by_symbol: dict[str, dict[str, list[TickCandle]]] = {}

def run(self) -> dict[str, Any]:
    # Step 0 (NEW): Pre-fetch all data in parallel
    self._prefetch_all_data()

    # Step 1: Check existing data (unchanged)
    existing_dates = self._fetch_existing_dates()

    # Step 2: Calculate features (now passes shared collectors)
    component_stats = self._calculate_component_features(existing_dates)

    # Step 3: Calculate index (now passes pre-fetched data)
    index_candles = self._calculate_index_candles()

    # Step 4: Aggregate (now passes pre-fetched stocks_info)
    aggregated_df = self._aggregate_features()

    # Step 5: Merge and persist (unchanged)
    vn30_written = self._persist_vn30(index_candles, aggregated_df)
    # ...
```

- [x] Implement `_prefetch_all_data()` with per-symbol error isolation:

```python
def _prefetch_all_data(self) -> None:
    """Pre-fetch tick candles, prices, and stock info for all 30 symbols in parallel."""
    def _prefetch_symbol(symbol: str) -> tuple[str, StockDataCollector, Stock]:
        collector = StockDataCollector(
            symbol=symbol,
            start_date=self.start_date,
            end_date=self.end_date,
            interval=self.interval,
        )
        collector.tick_candles_by_date()  # populate cache (also fetches prices internally)
        stock = collector.stock()         # populate cache
        return symbol, collector, stock

    prefetch_errors: list[str] = []

    with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
        futures = {
            executor.submit(_prefetch_symbol, symbol): symbol
            for symbol in VN30_SYMBOLS
        }
        for future in as_completed(futures):
            symbol = futures[future]
            try:
                symbol, collector, stock = future.result()
                self._collectors[symbol] = collector
                self._stocks_info[symbol] = stock
                self._tick_candles_by_symbol[symbol] = collector.tick_candles_by_date()
            except Exception as e:
                self._logger.error(f"[VN30Pipeline] Prefetch failed for {symbol}: {e}")
                prefetch_errors.append(symbol)

    if prefetch_errors:
        raise ValueError(
            f"Prefetch failed for {len(prefetch_errors)} symbols: {prefetch_errors}. "
            f"Index calculation requires all 30 symbols. Aborting pipeline."
        )
```

> **Note on `prices()` prefetch:** `tick_candles_by_date()` internally calls `self.prices()` (line 227 of `stock_data_collector.py`), so prices are implicitly prefetched for all 30 symbols. Explicit `collector.prices()` call is unnecessary.

### Phase 3: Parallelize Per-Symbol Feature Computation

**File:** `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/persistor/vn30/vn30_feature_pipeline.py`

- [x] Refactor `_calculate_component_features()` to use ThreadPoolExecutor
- [x] Extract single-symbol processing into `_process_single_symbol()` for thread submission
- [x] Collect results and errors from futures

```python
def _calculate_component_features(self, existing_dates: dict[str, set[str]]) -> dict[str, int]:
    requested_dates = self._get_requested_dates()
    symbols_to_process = []
    skipped = 0

    for symbol in VN30_SYMBOLS:
        existing = existing_dates.get(symbol, set())
        if not self.force_recalculate and existing >= requested_dates:
            skipped += 1
            continue
        symbols_to_process.append(symbol)

    processed = 0
    errors = 0

    with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
        futures = {
            executor.submit(self._process_single_symbol, symbol): symbol
            for symbol in symbols_to_process
        }
        for future in as_completed(futures):
            symbol = futures[future]
            try:
                result = future.result()
                processed += 1
            except Exception as e:
                self._logger.error(f"[VN30Pipeline] {symbol}: ✗ Error: {e}")
                errors += 1

    if errors > 0:
        raise ValueError(
            f"[VN30Pipeline] {errors} symbols failed feature calculation. "
            f"Index calculation and aggregation require all 30 symbols. Aborting."
        )

    return {"processed": processed, "skipped": skipped, "errors": errors}

def _process_single_symbol(self, symbol: str) -> dict[str, Any]:
    collector = self._collectors.get(symbol)
    persistor = IntradaySymbolFeaturePersistor(
        symbol=symbol,
        start_date=self.start_date,
        end_date=self.end_date,
        interval=self.interval,
        stock_data_collector=collector,  # pass shared collector
    )
    return persistor.persist()
```

### Phase 4: Pass Pre-fetched Data to Index Calculator & Aggregator

**File:** `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/persistor/vn30/vn30_feature_pipeline.py`

- [x] Update `_calculate_index_candles()` to pass pre-fetched data:

```python
def _calculate_index_candles(self) -> list[VN30IndexCandle]:
    calculator = TickVN30IndexCalculator(
        start_date=self.start_date,
        end_date=self.end_date,
        use_free_float=True,
        tick_candles_by_symbol=self._tick_candles_by_symbol,  # NEW
        stocks_info=self._stocks_info,                         # NEW
    )
    return calculator.calculate()
```

- [x] Update `_aggregate_features()` to pass pre-fetched stocks_info:

```python
def _aggregate_features(self) -> pd.DataFrame:
    aggregator = VN30WhaleFootprintAggregator(
        start_date=self.start_date,
        end_date=self.end_date,
        interval=self.interval,
        stocks_info=self._stocks_info,  # NEW
    )
    return aggregator.calculate()
```

### Phase 5: Fix Minor Issues

- [x] Fix `_find_candle_at_timepoint` in `TickVN30IndexCalculator` — build lookup dict for O(1) access instead of O(N) linear scan
- [x] Fix VN30 index OHLCV rounding: keep `float` (2 decimal places from `TickVN30IndexCalculator`) instead of `round()` to `int`

## Affected Files Summary

| File | Changes |
|---|---|
| `stock_data_collector.py` | Move `_cached_data` from class-level to instance-level (thread safety) |
| `intraday_symbol_feature_persistor.py` | Add optional `stock_data_collector` param |
| `tick_vn30_index_calculator.py` | Add optional pre-fetched data params; fix `_find_candle_at_timepoint` to O(1) |
| `vn30_whale_footprint_aggregator.py` | Add optional `stocks_info` param; fix hard-coded `30` |
| `vn30_feature_pipeline.py` | Add `max_workers` param; interval guard clause; add `_prefetch_all_data()` with error isolation; parallelize Steps 0 & 2; pass cached data to Steps 3 & 4 |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Supabase rate limit / connection exhaustion | Medium | High | `max_workers` configurable, default 6. Can lower to 3-4 if needed. |
| Thread safety (class-level cache) | **Eliminated** | — | Phase 0 moves `_cached_data` to instance-level. Each thread has its own collector. |
| Partial failure in parallel prefetch | Medium | High | Per-future try/except. Prefetch errors abort pipeline (index calc requires all 30). Feature step errors are isolated. |
| Memory pressure from pre-fetching | Low | Low | ~50-100MB for typical 30-day range. Acceptable for batch processing. |
| Interval mismatch with TickVN30IndexCalculator | **Eliminated** | — | Guard clause in `__init__` enforces `FIVE_MINUTES`. |

## Testing Strategy

1. Run pipeline with `max_workers=1` (sequential fallback) — verify identical output to current behavior
2. Run pipeline with `max_workers=6` — verify same output, observe timing improvement
3. Verify standalone usage of each modified component (without pre-fetched data) still works
4. Simulate single-symbol failure to verify error isolation

## Execution Checklist

- [x] Phase 0: `StockDataCollector` — move `_cached_data` to instance-level
- [x] Phase 1a: `IntradaySymbolFeaturePersistor` — optional `stock_data_collector`
- [x] Phase 1b: `TickVN30IndexCalculator` — optional pre-fetched data
- [x] Phase 1c: `VN30WhaleFootprintAggregator` — optional `stocks_info`
- [x] Phase 1d: Fix hard-coded `30`
- [x] Phase 2: `VN30FeaturePipeline` — interval guard + shared data layer + `_prefetch_all_data()` with error isolation
- [x] Phase 3: `VN30FeaturePipeline` — parallel `_calculate_component_features()`
- [x] Phase 4: `VN30FeaturePipeline` — pass pre-fetched data to Steps 3 & 4
- [x] Phase 5a: Fix `_find_candle_at_timepoint` O(1) lookup
- [x] Phase 5b: Fix VN30 index OHLCV float precision
- [x] Linter check
- [ ] Test: `max_workers=1` sequential correctness
- [ ] Test: `max_workers=6` parallel correctness + timing

## Summary of Results

### Completed Achievements

- [To be filled after implementation]

## Implementation Notes / As Implemented

- Implemented all planned code changes across 5 target source files with additive interfaces for backward compatibility.
- `StockDataCollector` cache is now instance-scoped, removing class-level shared mutable state for thread safety.
- Added optional injected data paths:
  - `IntradaySymbolFeaturePersistor(..., stock_data_collector=...)`
  - `TickVN30IndexCalculator(..., tick_candles_by_symbol=..., stocks_info=...)`
  - `VN30WhaleFootprintAggregator(..., stocks_info=...)`
- Refactored `VN30FeaturePipeline`:
  - Added `max_workers` (default `6`) and guard clause enforcing `IntradayInterval.FIVE_MINUTES`
  - Added `_prefetch_all_data()` with per-symbol error isolation and abort-on-any-failure behavior
  - Parallelized component feature persistence via `_process_single_symbol()` and `ThreadPoolExecutor`
  - Passed pre-fetched tick/stocks data into index calculator and aggregator
  - Preserved VN30 index OHLC as float values (no int rounding in persistence row mapping)
- Optimized `TickVN30IndexCalculator` candle retrieval:
  - Replaced O(N) search per symbol/timepoint with O(1) lookup map built once per symbol
  - Added guard clauses for missing injected stock/tick data
- Validation performed:
  - `uv run ruff check` on modified files: passed
  - `uv run python -m compileall` on modified files: passed
- Not run (per task rule / not explicitly requested):
  - End-to-end runtime tests for `max_workers=1` and `max_workers=6`
