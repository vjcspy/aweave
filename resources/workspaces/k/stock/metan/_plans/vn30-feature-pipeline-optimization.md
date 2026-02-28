---
name: "VN30 Feature Pipeline Early Exit Optimization"
description: "Refactors VN30FeaturePipeline.run() to check existing VN30 dates first (before expensive prefetch), adds early-exit if all dates present, and segments missing dates into continuous ranges for minimal re-computation."
tags: [metan, vn30, pipeline, optimization, early-exit, python]
category: plan
status: done
updated: 2026-02-28
---

# VN30 Feature Pipeline Optimization Plan

## Objective

Optimize the `VN30FeaturePipeline` so that it completely skips data fetching and calculations if the VN30 feature data for the requested dates is already persisted in the database.

## Current Bottleneck

Currently, the `run()` pipeline executes in this order:

1. `_prefetch_all_data()`: Initializes `StockDataCollector` and fetches tick/price data for ALL 30 symbols over the internet for the given `start_date` and `end_date`.
2. `_fetch_existing_dates()`: Queries the DB for what dates actually exist.
3. Component calculation...

This means even if the `VN30` data already exists for the day, the pipeline still downloads gigabytes of tick data into memory unnecessarily.

## Proposed Changes

### 1. Refactor Flow Order in `run()`

Move `_fetch_existing_dates()` up to be the **First Step** before `_prefetch_all_data()`. This allows us to make pipeline-level routing decisions before spending resources on networking/memory.

### 2. Implement Early Exit

Compute the `requested_dates` upfront. Check if the `VN30_SYMBOL` already has all the requested dates in the database.

```python
# In run(), after _fetch_existing_dates()
requested_dates = self._get_requested_dates()
existing_vn30_dates = existing_dates.get(VN30_SYMBOL, set())

if not self.force_recalculate and existing_vn30_dates >= requested_dates:
    self._logger.info(f"[VN30Pipeline] VN30 data fully exists for requested dates. Exiting early.")
    return {
        "status": "skipped",
        "message": "VN30 data already persisted for all requested dates.",
        "start_date": self.start_date,
        "end_date": self.end_date,
        ...
    }
```

### 3. Handle Missing Dates and Execution Window

If some dates are present but others are missing, we should only process the missing dates. To avoid fetching data for dates we already have, we will group the `missing_dates` into continuous date segments.

For each continuous segment, we will define local variables `execution_start` and `execution_end`. We will **NOT** mutate `self.start_date` and `self.end_date` during this process to avoid side effects and ensure the final summary correctly reflects the original requested range.

```python
missing_dates = requested_dates - existing_vn30_dates if not self.force_recalculate else requested_dates
if missing_dates:
    # Group missing_dates into continuous segments
    segments = group_into_continuous_segments(sorted(missing_dates))
    
    for segment_start, segment_end in segments:
        self._logger.info(f"[VN30Pipeline] Processing missing segment: {segment_start} -> {segment_end}")
        # Execute pipeline for this segment
        self._prefetch_all_data(segment_start, segment_end)
        self._calculate_component_features(segment_start, segment_end, existing_dates)
        index_candles = self._calculate_index_candles(segment_start, segment_end)
        aggregated_df = self._aggregate_features(segment_start, segment_end)
        self._persist_vn30(index_candles, aggregated_df)
```

### 4. Method Signature Refactoring

To ensure downstream methods operate on the correct segment without mutating `self.start_date` and `self.end_date`, we will update the signatures of the following internal methods:

1. `_prefetch_all_data(self, segment_start: str, segment_end: str) -> None`
2. `_process_single_symbol(self, symbol: str, segment_start: str, segment_end: str) -> dict[str, Any]`
3. `_calculate_component_features(self, segment_start: str, segment_end: str, existing_dates: dict[str, set[str]]) -> dict[str, int]`
4. `_calculate_index_candles(self, segment_start: str, segment_end: str) -> list[VN30IndexCandle]`
5. `_aggregate_features(self, segment_start: str, segment_end: str) -> pd.DataFrame`

Inside these methods, they will use `segment_start` and `segment_end` when initializing calculators or collectors (e.g., `StockDataCollector(start_date=segment_start, end_date=segment_end)`).

### 5. Final Output Summary

The `run()` method will return a modified summary dictionary representing the original requested range and the actual processed segments:

```python
return {
    "status": "success",
    "requested_start_date": self.start_date,
    "requested_end_date": self.end_date,
    "processed_segments": segments,
    # aggregate stats across all segments...
}
```

## Review

Does this approach align with your goal of preventing calculations if the day is already persisted?

## Implementation Notes / As Implemented

- Refactored `VN30FeaturePipeline.run()` order so `_fetch_existing_dates()` executes before any prefetch.
- Added early-exit for full VN30 coverage:
  - If `force_recalculate=False` and all requested weekday dates already exist for `VN30`, the pipeline now returns `status="skipped"` before fetching component data.
- Added date-range filtering path for partial coverage:
  - Computes `missing_dates` from requested weekdays minus existing VN30 dates (or full requested range when `force_recalculate=True`).
  - Groups missing dates into continuous calendar segments via `_group_into_continuous_segments(...)`.
  - Executes prefetch/calculate/index/aggregate/persist per segment.
- Refactored method signatures to segment-aware execution without mutating `self.start_date` / `self.end_date`:
  - `_prefetch_all_data(segment_start, segment_end)`
  - `_process_single_symbol(symbol, segment_start, segment_end)`
  - `_calculate_component_features(segment_start, segment_end, existing_dates)`
  - `_calculate_index_candles(segment_start, segment_end)`
  - `_aggregate_features(segment_start, segment_end)`
- Updated `_get_requested_dates(...)` to accept optional `start_date` and `end_date` inputs for segment-level weekday calculation.
- Updated output summary:
  - Preserves existing keys (`start_date`, `end_date`, counters).
  - Adds `requested_start_date`, `requested_end_date`, `requested_dates_count`, `vn30_existing_dates_count`, `vn30_missing_dates_count`, and `processed_segments`.
- Validation:
  - `ruff check` passed for:
    - `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/persistor/vn30/vn30_feature_pipeline.py`

### Follow-up correction (critical)

- Missing-date detection is now anchored to `prices` trading days:
  - Added `_fetch_trading_dates_from_prices(start_date, end_date)` in `VN30FeaturePipeline`.
  - `run()` now computes `dates_to_calculate = requested_weekday_dates ∩ trading_dates_from_prices`.
  - Early-exit/full-coverage checks and `missing_dates` segmentation are now based on `dates_to_calculate` (not raw weekdays).
- This prevents false recalculation on holidays/non-trading weekdays where no prices exist.
