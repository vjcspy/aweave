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

### 3. Narrow `start_date` and `end_date` Window

If some dates are present but others are missing (e.g., pipeline reran for the week but Monday and Tuesday are already there), we shouldn't pre-fetch data for Monday and Tuesday.

```python
missing_dates = requested_dates - existing_vn30_dates if not self.force_recalculate else requested_dates
if missing_dates:
    # Optional but highly recommended: Narrow the time boundaries to save fetch cost
    new_start = min(missing_dates)
    new_end = max(missing_dates)
    self.start_date = new_start
    self.end_date = new_end
    
    self._logger.info(f"[VN30Pipeline] Adjusted processing window to {new_start} -> {new_end}")
```

### 4. Execute Rest of Pipeline

After early exits and boundary shrinking, proceed with `_prefetch_all_data()` for the remaining window and continue the normal pipeline steps (`_calculate_component_features`, `_calculate_index_candles`, etc.).

## Review

Does this approach align with your goal of preventing calculations if the day is already persisted?
