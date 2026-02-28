---
name: "Metan Stock"
description: "Python feature-engineering pipeline for Vietnamese stock analytics: builds whale footprint features and VN30-level AI-ready feature candles from Supabase tick/price data using StockDataCollector and VN30FeaturePipeline."
tags: [python, stock, feature-engineering, vn30, supabase, ai, vietnam]
updated: 2026-02-28
---

> **Branch:** workspaces/k
> **Last Commit:** c0dcbca
> **Last Updated:** 2026-02-28

## TL;DR

`metan-stock` is a Python package within the `metan-workspace` (uv workspace). Its heart is `StockDataCollector` — a central data loader for ticks, prices, and stock metadata from Supabase. The package delivers end-to-end VN30 feature pipelines: tick-based index calculation + whale footprint feature aggregation → persisted to Supabase as AI-ready `symbol="VN30"` feature candles. **Status (Jan 2026): VN30FeaturePipeline complete and operational.**

## Repo Purpose & Bounded Context

- **Role:** Offline/nearline data shaping and feature generation pipeline for model-ready datasets; upstream of AI model testing for VN30F1M derivative prediction
- **Domain:** `k/stock` — transforms raw tick/price data from Supabase (written by `jmeta`) into feature candles consumed by `meta` dashboard

## Project Structure

- `packages/stock/metan/stock/` — main package
  - `info/` — data collection layer
    - `domain/stock_data_collector/` — `StockDataCollector` (central data loader/cacher)
    - `domain/index/` — VN30 index calculators (tick-based and TCBS-based)
    - `domain/candle/` — candle models and intraday timepoints service
    - `domain/price/`, `domain/tick/`, `domain/stock/` — domain models
  - `trading/domain/feature/` — feature computation layer
    - `calculator/whale_footprint/` — whale footprint feature calculator (shark/sheep classification)
    - `aggregator/vn30/` — VN30-level aggregation from 30 component stocks
    - `persistor/intraday/` — per-symbol feature persistence to Supabase
    - `persistor/vn30/` — `VN30FeaturePipeline` (complete end-to-end pipeline)
  - `testbed/` — CLI entry points for pipeline execution

## Public Surface (Inbound)

- **Command line:** `python -m metan.stock.testbed.build_vn30_features --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> [--force]`
- **Programmatic API:** `VN30FeaturePipeline(start_date, end_date, force_recalculate).run()`
- **Data source:** Supabase tables `stock_info_ticks`, `stock_info_prices`, `stock_info_stocks`, `stock_common_configuration`

## Core Services & Logic (Internal)

- **StockDataCollector:** Central data loader/cacher for a symbol+date range. Methods: `stock()`, `ticks()`, `tick_candles_by_date()` ⭐ (primary), `prices()`, `price_candles_by_date()` (limited/TCBS). Caches results by key to reduce Supabase queries
- **TickVN30IndexCalculator:** Calculates VN30 index candles from tick data (Supabase) using market cap weighting and free-float ratios. Consistent with whale footprint feature source
- **WhaleFootprintFeatureCalculator:** Classifies trades into shark (≥450M or ≥900M VND) / sheep categories, computes buy/sell values, cumulative average prices, ratio vs 5D baseline, and VWAP urgency spreads
- **VN30WhaleFootprintAggregator:** Aggregates whale footprint features from all 30 VN30 component stocks → VN30-level features (sum for values, weighted average for urgency)
- **VN30FeaturePipeline:** Orchestrates batch date check → smart skip → index calc → feature aggregation → Supabase upsert
- **IntradayTimepointsService:** Builds and persists trading session timepoint configs per exchange/interval

## External Dependencies & Contracts (Outbound)

- **Databases:** Supabase — reads `stock_info_*` tables; writes/upserts `stock_trading_feature_candles` (unique constraint: `symbol, time`)
- **Message Queues:** None
- **External APIs:** TCBS REST (`apiextaws.tcbs.com.vn/stock-insight/v2/stock/bars`) — limited use for `price_candles_by_date()` and timepoints service; Bearer token auth via `StockInfoConfiguration.tcbs_token`
- **Workspace dependencies:** `metan-core` (logging, env settings base), `metan-supabase` (shared supabase client)
- **Key libraries:** `pendulum`, `pandas`, `requests`, `pydantic`

## Key Notes

- All monetary values in **millions VND** — comparison threshold 450M = `450 * 1_000_000` raw VND
- Trade directions: `'B'` (Buy), `'S'` (Sell), `'Undefined'` (ATO/ATC — excluded from whale footprint)
- Free-float ratios range 0.04 (BID, BCM, GVR) to 1.00 (DGC, LPB, STB); default 1.0 for unknown symbols
