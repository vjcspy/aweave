---
name: "Implement Supabase Retry Decorator"
description: "Adds with_supabase_retry() decorator using tenacity for transient Supabase/httpx errors (Errno 35, timeouts, 502-504): chunk-level retry in intraday persistor and select-level retry in StockDataCollector."
tags: [metan, supabase, retry, tenacity, resilience, python]
category: plan
status: done
updated: 2026-02-21
---

# 260221-implement-supabase-retry-decorator

## Context

When running highly concurrent workers, Supabase interactions often fail with transient network or resource errors, such as `Errno 35` (Resource temporarily unavailable) or underlying `httpx` timeouts. We need a resilience mechanism to retry these transient failures automatically to avoid pipeline disruptions.

*(Per reviewer feedback, we have addressed path locations, dependency alignment, chunk-level retry boundaries, comprehensive test coverage, and strict detection order).*

## Proposed Changes

### Component 1: The Decorator and Dependency

#### [MODIFY] `workspaces/k/stock/metan/packages/supabase/pyproject.toml`

We will add `tenacity` as a dependency to the `metan-supabase` package since the retry utility will live there natively, ensuring consumers have transitively correct dependencies.

#### [NEW] `workspaces/k/stock/metan/packages/supabase/metan/supabase/retry.py`

We will introduce a generic retry decorator that can be imported alongside the `supabase` client.

- **`is_retryable_supabase_error(exception)`**: Inspects the exception stack. Detection logic must prioritize structured checks:
  1. **Structured status code**: Check `exc.response.status_code` (if available via `httpx.HTTPStatusError` or `PostgrestAPIError` wrapper) for 502, 503, 504.
  2. **Exception Class**: Match types like `httpx.ConnectTimeout`, `httpx.ReadTimeout`, `httpx.ConnectError`, `httpx.NetworkError`.
  3. **String Fallback**: Only as a last resort, check for "Resource temporarily unavailable" or "Errno 35" in the exception message.
  - *Must traverse `__cause__` and `__context__` for all steps.*
- **`with_supabase_retry()`**: A flexible Python decorator utilizing `@retry` from `tenacity`.
  - Configured with `wait=wait_random_exponential(multiplier=1, max=60)` for jitter.
  - Configured with `stop=stop_after_attempt(5)` (up to 5 attempts).
  - Configured with `retry=retry_if_exception(is_retryable_supabase_error)`.

### Component 2: Applying the Decorator

#### [MODIFY] `workspaces/k/stock/metan/packages/stock/metan/stock/trading/domain/feature/persistor/intraday/intraday_symbol_feature_persistor.py`

The inner loop of `_persist_rows` currently swallows exceptions per-chunk. Putting a decorator on `_persist_rows` will silently fail.

- **Change**: We will extract the inner `supabase.table(...).upsert(chunk).execute()` call into a new private method `_upsert_chunk(chunk)`.
- Apply `@with_supabase_retry()` to `_upsert_chunk(chunk)`.
- If `_upsert_chunk` exhausts all retries, the outer `_persist_rows` layer can catch the exception, log the failure, but this ensures `tenacity` is actually given a chance to see the exceptions and retry the chunk first.

#### [MODIFY] `workspaces/k/stock/metan/packages/stock/metan/stock/info/domain/stock_data_collector/stock_data_collector.py`

Apply `@with_supabase_retry()` to all non-mutating `select` functions against Supabase. These functions naturally raise on error, so they are safe to decorate directly:

- `stock()`
- `_resolve_lookback_start()`
- `_fetch_ticks()`
- `_fetch_prices()`

## Verification Plan

### Automated Testing Matrix

We will implement deterministic test behavior to verify the Supabase retry layer.

1. **Success at Attempt N**: Mock the Supabase client to raise `httpx.ReadTimeout` twice, then return success on the third attempt. Asserts that the wrapped method succeeds and the underlying client was called 3 times.
2. **Exhaustion (Max Retries)**: Mock the client to endlessly raise `Errno 35`. Assert that it correctly raises an exception after exactly 5 attempts.
3. **Non-Retryable Errors**: Mock the client to raise a permanent business exception (e.g., `ValueError` or a HTTP 400 Bad Request exception). Assert that `tenacity` does *not* retry and fails immediately on the 1st attempt.
4. **Chunk-Level Behavior `_persist_rows`**: Verify that `_upsert_chunk` correctly bubbles exceptions to `tenacity` and manages state at the chunk level.

### Execution Boundaries

- **Retry Scope**: Retry policy applies strictly at the *callsite* or *chunk-level request* within `_persist_rows`, not the entire method payload.
- **Latency Cutoff**: `tenacity` naturally bounds latency. With `stop=stop_after_attempt(5)` and `max=60` backoff, worst-case delay per request caps around a couple minutes before failing rather than blocking indefinitely.
