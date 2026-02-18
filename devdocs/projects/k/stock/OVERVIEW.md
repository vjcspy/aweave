## Metadata Header
> **Branch:** projects/k
> **Last Commit:** 305dc62
> **Last Updated:** Wed Feb 18 11:37:09 2026 +0700

## k/stock Global Overview (TL;DR)

The `k/stock` scope is a multi-repo stock platform for Vietnamese market data and analytics. It combines a Quarkus ingestion/API backend (`jmeta/stock`), a Python feature-engineering pipeline (`metan`), and a Next.js dashboard (`meta`) to deliver an end-to-end flow from raw ticks/prices to VN30-level features and UI consumption.

## Recent Changes Log

- Initial global overview generation from:
  - `devdocs/projects/k/stock/jmeta/stock/OVERVIEW.md`
  - `devdocs/projects/k/stock/metan/OVERVIEW.md`
  - `devdocs/projects/k/stock/meta/OVERVIEW.md`
- Latest notable package-level changes (from source overviews):
  - `metan`: VN30 feature pipeline completion (collector -> index calculation -> aggregation -> persistence).
  - `jmeta/stock`: mature reactive ingestion and messaging flows for stocks, prices, ticks, and trading analysis.
  - `meta`: dashboard conventions stabilized around widget containers, chart components, and local user-config persistence.

## Repo Purpose & Bounded Context

- **Platform Role:** Build and operate stock data ingestion, transformation, analysis, and visualization.
- **Domain:** Vietnam equities intraday and daily analytics, including VN30-derived feature computation.
- **Boundaries by repo:**
  - `jmeta/stock`: service-side ingestion, REST APIs, schedulers, reactive orchestration, and queue-based async processing.
  - `metan`: offline/nearline data shaping and feature generation pipelines for model-ready datasets.
  - `meta`: frontend experience for dashboarding, chart interaction, and operator workflows.

## Project Structure

- `devdocs/projects/k/stock/jmeta/stock/`
  - Quarkus multi-module service context (`shared/*`, `packages/*`, `projects/http`).
  - Focus: runtime APIs, event/messaging pipelines, and persistence-backed synchronization.
- `devdocs/projects/k/stock/metan/`
  - Python package context centered around `packages/stock/metan/stock/*`.
  - Focus: `StockDataCollector`, whale-footprint features, VN30 index and aggregation pipelines.
- `devdocs/projects/k/stock/meta/`
  - Web app context for `projects/stock/apps/web`.
  - Focus: widgetized dashboard UI, chart rendering, and browser-level configuration persistence.

## Controllers & Public Surface (Inbound)

- **Service APIs (`jmeta/stock`):**
  - REST resources for stock entities, price history, ticks, and trading analysis.
  - Manual and scheduled sync triggers for ingestion flows.
  - RabbitMQ consumers for stock info and trading-analysis command handling.
- **Pipeline entry points (`metan`):**
  - Script/testbed style command entry points for feature calculation and VN30 pipeline execution.
  - Primary operational path includes end-to-end VN30 feature build flow.
- **Web UI (`meta`):**
  - Next.js pages including dashboard entry (`/dashboard`) with responsive grid widgets.
  - Client-side controls for filtering, chart interaction, and persisted widget/user preferences.

## Core Services & Logic (Internal)

- **Data ingestion and orchestration (`jmeta/stock`):**
  - Market data pull from provider APIs.
  - Reactive effect/event model to sequence sync operations.
  - Correlated message lifecycle for reliable async execution and error handling.
- **Feature engineering and aggregation (`metan`):**
  - `StockDataCollector` as canonical source for candles/ticks/prices/stock metadata.
  - Whale-footprint feature calculators over tick-derived structures.
  - VN30 index and feature aggregation with persistence for model consumption.
- **Presentation and UX composition (`meta`):**
  - Separation between pure chart components and data-aware dashboard containers.
  - Grid-based dashboard composition with drag/resize and client-only persistence.

## External Dependencies & Cross-Service Contracts (Outbound)

- **Databases:**
  - PostgreSQL + Flyway in `jmeta/stock`.
  - Supabase-backed storage in `metan`.
  - Browser `localStorage` for user config in `meta`.
- **Message Queues:**
  - RabbitMQ channels for stock info synchronization and trading-analysis processing in `jmeta/stock`.
- **External APIs:**
  - Vietstock (listing/corporate data).
  - FireAnt (historical prices).
  - Simplize (tick data).
  - TCBS (selected intraday/index-related retrieval paths).
- **Notification/ops integrations:**
  - Slack-based operational reporting and alert flows.
- **Cross-repo contracts (inferred from source overviews):**
  - Shared symbol/date/timepoint semantics and OHLCV-style feature structures are required so ingestion (`jmeta/stock`), feature pipelines (`metan`), and dashboard consumers (`meta`) remain aligned.
