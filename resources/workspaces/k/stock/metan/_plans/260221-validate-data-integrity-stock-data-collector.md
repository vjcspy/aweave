---
name: "Validate Data Integrity in StockDataCollector"
description: "Moves data integrity validation (prices vs ticks date-set comparison) into StockDataCollector.validate_data_integrity() with class-level range superset cache; removes validate_dayset_equality from feature calculator layer."
tags: [metan, stock-data-collector, validation, data-integrity, python]
category: plan
status: done
updated: 2026-02-21
---

# 260221 - Validate Data Integrity in StockDataCollector

## References

- `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/stock_data_collector/stock_data_collector.py` — Target file for new validation method
- `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/calculator/common/base.py` — Current `validate_dayset_equality` (to be removed)
- `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/calculator/whale_footprint/whale_footprint_feature_calculator.py` — Current caller (to be updated)
- `resources/workspaces/k/stock/metan/OVERVIEW.md` — Project overview

## User Requirements

1. Create a validation function in `StockDataCollector` to validate data instead of writing in any top layer.
2. Need to implement cache (if we already validate it -> don't need to run again for all instances of class based on start_date and end_date).
3. Fetch prices and ticks, and compare/check if any missing data in ticks, if yes -> throw error.
4. Lookback coverage: validation should cover the lookback range. If a larger range was already validated, a subset range should not trigger re-validation.
5. Cache scope: key must include symbol.
6. After implementing: remove `validate_dayset_equality` from `common/base.py` and update `WhaleFootprintFeatureCalculator` to use the new approach.

## Objective

Move data integrity validation (prices vs ticks date-set comparison) from the feature calculator layer down into `StockDataCollector`. The new method validates that every trading day (determined by prices) has corresponding tick data. It uses a class-level range cache so that:

- Multiple instances with the same `(symbol, date range)` don't re-validate.
- A previously validated superset range covers any subset range without additional DB queries.

### Key Considerations

- **Prices are source of truth**: Prices data always reflects the exact set of trading days. Ticks data may be incomplete due to cron job failures.
- **Fail-fast**: Any missing tick data must cause an immediate error — data consistency is top priority for stock analysis.
- **Smart range cache**: The cache must support subset detection. If `(VNM, 2025-01-01, 2025-01-31)` is validated, then `(VNM, 2025-01-10, 2025-01-20)` is covered and should skip validation.
- **Lookback-aware**: When `lookback_days > 0`, the effective validation range extends before `start_date` (using `_resolve_lookback_start`). The cache stores the effective range, not just the user-provided range.
- **Class-level cache**: Must be a `ClassVar` so all instances share validation state within the same process.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Confirm validation logic: for every date in `prices` within `[effective_start, end_date]`, there must be a corresponding date in `ticks`
  - **Outcome**: Validation compares `set(price_dates) - set(tick_dates)` → if non-empty, raise `ValueError` listing the missing dates
- [x] Define cache data structure
  - **Outcome**: `ClassVar[dict[str, list[tuple[str, str]]]]` — key is `symbol`, value is list of `(start, end)` validated ranges
- [x] Define subset-check algorithm
  - **Outcome**: For a given `(symbol, start, end)`, iterate the symbol's validated ranges and return `True` if any range `(vs, ve)` satisfies `vs <= start` and `ve >= end`

### Phase 2: Implementation Structure

```
workspaces/k/stock/metan/packages/stock/metan/stock/
├── info/domain/stock_data_collector/
│   └── stock_data_collector.py          # 🔄 Add validate_data_integrity + class-level cache
├── trading/domain/feature/calculator/
│   ├── common/
│   │   └── base.py                      # 🔄 Remove validate_dayset_equality
│   └── whale_footprint/
│       └── whale_footprint_feature_calculator.py  # 🔄 Replace validate_dayset_equality call
```

### Phase 3: Detailed Implementation Steps

#### Step 1: Add class-level cache to `StockDataCollector`

File: `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/stock_data_collector/stock_data_collector.py`

- [x] Update existing import to include `ClassVar`:

  ```python
  from typing import Any, ClassVar, cast
  ```

  (existing line 2 is `from typing import Any, cast` — merge `ClassVar` into it)
- [x] Add class-level attribute with sequential-only constraint:

  ```python
  # Not thread-safe: only use in sequential execution contexts.
  _validated_integrity_ranges: ClassVar[dict[str, list[tuple[str, str]]]] = {}
  ```

  Key: `symbol`, Value: list of `(effective_start, end_date)` tuples that have been validated.
- [x] Note: subset check only covers single continuous ranges. Overlapping/adjacent ranges (e.g., `(01-01, 01-10)` + `(01-11, 01-20)`) are stored separately and won't cover a cross-range request like `(01-05, 01-15)`. This is acceptable because in practice, all callers within a pipeline run use the same date range per symbol.

#### Step 2: Add `_is_range_already_validated` private method

File: `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/stock_data_collector/stock_data_collector.py`

- [x] Implement subset check:

  ```python
  @classmethod
  def _is_range_already_validated(cls, symbol: str, start: str, end: str) -> bool:
      for vs, ve in cls._validated_integrity_ranges.get(symbol, []):
          if vs <= start and ve >= end:
              return True
      return False
  ```

  String comparison on `YYYY-MM-DD` dates works correctly for lexicographic ordering.

#### Step 3: Add `validate_data_integrity` public method

File: `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/stock_data_collector/stock_data_collector.py`

- [x] Implement the method:

  ```python
  def validate_data_integrity(self, lookback_days: int = 0) -> None:
      effective_start = (
          self._resolve_lookback_start(lookback_days) if lookback_days > 0 else self.start_date
      )

      if self._is_range_already_validated(self.symbol, effective_start, self.end_date):
          self._logger.info(
              f"[{self._ctx()}] data integrity already validated for range {effective_start} -> {self.end_date}"
          )
          return

      prices = self._fetch_prices(effective_start, self.end_date)
      ticks = self._fetch_ticks(effective_start, self.end_date)

      price_dates = {p.date for p in prices}
      tick_dates = {t.date for t in ticks}

      missing_in_ticks = sorted(price_dates - tick_dates)
      if missing_in_ticks:
          raise ValueError(
              f"[{self._ctx()}] Missing tick data for trading days: {missing_in_ticks}. "
              f"Prices exist for these dates but ticks do not. "
              f"Validated range: {effective_start} -> {self.end_date}"
          )

      self._validated_integrity_ranges.setdefault(self.symbol, []).append(
          (effective_start, self.end_date)
      )
      self._logger.info(
          f"[{self._ctx()}] data integrity validated: {len(price_dates)} trading days, "
          f"range {effective_start} -> {self.end_date}"
      )
  ```

  Key behaviors:
  1. Resolves effective start date using `_resolve_lookback_start` (reuses existing cache).
  2. Checks class-level cache for superset range → early return if covered.
  3. Fetches prices and ticks (both leverage instance-level `_cached_data` → no redundant DB calls if data was already fetched).
  4. Compares date sets: `price_dates - tick_dates` → any non-empty result is an error.
  5. On success, registers the validated range in the class-level cache.

#### Step 4: Remove `validate_dayset_equality` from `common/base.py`

File: `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/calculator/common/base.py`

- [x] Delete the `validate_dayset_equality` function (lines 145–153)
- [x] Remove related imports if any become unused (`Price`, `TickCandle` — verify usage by other functions in the same file first)

#### Step 5: Update `WhaleFootprintFeatureCalculator`

File: `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/calculator/whale_footprint/whale_footprint_feature_calculator.py`

- [x] Remove `validate_dayset_equality` from the import block (line 22)
- [x] Replace the `validate_dayset_equality(...)` call (lines 100–105) with:

  ```python
  self.data_collector.validate_data_integrity(lookback_days=FEATURE_ROLLING_WINDOW_DAYS)
  ```

- [x] Place the call early in `_cal_candle_features`, before `tick_candles_by_date()` — this way validation runs first and fails fast before any heavy processing. Note: `validate_data_integrity` calls `_fetch_ticks` and `_fetch_prices` which populate the instance cache, so subsequent calls to `tick_candles_by_date()` and `prices()` reuse cached data.

#### Step 6: Verify no other callers of `validate_dayset_equality`

- [x] Grep the codebase for `validate_dayset_equality` to confirm no other files reference it
- [x] If clean, the removal in Step 4 is safe

## Summary of Results

### Completed Achievements

- Added `_validated_integrity_ranges` caching directly in `StockDataCollector` to optimize repetitive validations.
- Implemented `validate_data_integrity` method to replace top-layer date validation functionality.
- Removed legacy `validate_dayset_equality` in `base.py` and modified `WhaleFootprintFeatureCalculator`.
- Verified system-wide stability with a regex search showing no legacy callers remaining.

## Implementation Notes / As Implemented

- Validation effectively calls `_fetch_prices` and `_fetch_ticks`. No wasteful queries occur because instances retrieve directly from populated internal `_cached_data`.
- Updated unused `Price` model import alongside removal of `validate_dayset_equality` in `base.py`.

## Outstanding Issues & Follow-up

### Issues/Clarifications

- [ ] Thread safety — The class-level `_validated_integrity_ranges` dict is not thread-safe. Constraint: sequential execution only. If the pipeline ever moves to concurrent threads, a `threading.Lock` must be added around cache reads/writes. This is explicitly documented on the class attribute.
- [ ] Cache growth — The validated ranges list grows unbounded within a process lifetime. For long-running processes, consider a cleanup strategy. Acceptable for now since the pipeline runs as a batch job with finite date ranges.
- [ ] Range merging — Subset check does not handle overlapping/adjacent ranges. If `(01-01, 01-10)` and `(01-11, 01-20)` are both validated, `(01-05, 01-15)` will still trigger re-validation. Acceptable because current usage always validates with the same range per symbol within a pipeline run.
