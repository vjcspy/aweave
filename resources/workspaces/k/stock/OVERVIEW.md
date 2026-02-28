---
name: "K Stock"
description: "Multi-repo Vietnamese stock analytics domain: Quarkus ingestion/API backend (jmeta), Python feature-engineering pipeline (metan), and Next.js dashboard (meta), delivering end-to-end flow from raw market ticks to VN30-level AI-ready features."
tags: [stock, vietnam, quarkus, python, nextjs, vn30]
updated: 2026-02-28
---

> **Branch:** workspaces/k
> **Last Commit:** c0dcbca
> **Last Updated:** 2026-02-28

## TL;DR

The `k/stock` scope is a multi-repo stock platform for Vietnamese market data and analytics. It combines a Quarkus ingestion/API backend (`jmeta`), a Python feature-engineering pipeline (`metan`), and a Next.js dashboard (`meta`) to deliver an end-to-end flow from raw ticks/prices to VN30-level features and UI consumption.

## Domain Context

- **Business Context:** Build and operate stock data ingestion, transformation, analysis, and visualization for Vietnamese equities (HSX/HNX). Primary goal is producing AI-ready VN30F1M derivative prediction features.
- **Relationship to Other Domains:** Standalone domain within `k` workspace. The `misc` domain provides developer utilities (git relay) that are independent of stock logic.

## Cross-Repo Patterns

- Shared symbol/date/timepoint semantics across all three repos
- OHLCV-style feature structures ensure ingestion (`jmeta`), pipelines (`metan`), and dashboard (`meta`) stay aligned
- Supabase used as the shared data layer between `jmeta` (writes ticks/prices/stocks) and `metan` (reads for feature computation)
- All monetary values consistently stored in millions (VND)

## Domain-Specific Development

- **Data flow:** Vietstock/FireAnt/Simplize → `jmeta` (PostgreSQL + RabbitMQ) → Supabase → `metan` (VN30 feature pipeline) → `meta` (dashboard)
- **Repo boundaries:**
  - `jmeta`: service-side ingestion, REST APIs, schedulers, RabbitMQ-based async processing
  - `metan`: offline/nearline data shaping, whale footprint feature generation, VN30 pipeline
  - `meta`: Next.js widgetized dashboard; read-only consumer of Supabase feature data
- **External providers:** Vietstock (listings), FireAnt (historical prices), Simplize (ticks), TCBS (intraday candles — limited use)
- **Key databases:** PostgreSQL (jmeta), Supabase (shared read/write for metan and meta)
