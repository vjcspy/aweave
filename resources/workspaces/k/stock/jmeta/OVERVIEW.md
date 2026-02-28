---
name: "JMeta Stock"
description: "Quarkus multi-module service for Vietnamese stock market data ingestion, REST APIs, and analytics: syncs Vietstock listings, FireAnt prices, and Simplize ticks into PostgreSQL via RabbitMQ-driven reactive pipelines, and computes trading analysis."
tags: [quarkus, java, stock, rabbitmq, postgresql, reactive, vietnam]
updated: 2026-02-28
---

> **Branch:** workspaces/k
> **Last Commit:** c0dcbca
> **Last Updated:** 2026-02-28

## TL;DR

`jmeta` stitches together shared Quarkus infrastructure, a stock market ingestion + analytics engine, and a thin HTTP host. The `packages:stock` module is the business core: it syncs Vietstock listings, FireAnt daily prices, and Simplize ticks into PostgreSQL, exposes REST endpoints, and queues trading-analysis jobs. Shared modules supply reactive event orchestration, Slack telemetry, and cross-cutting filters.

## Repo Purpose & Bounded Context

- **Role:** Service-side ingestion, REST APIs, schedulers, reactive job orchestration, and trading analytics for Vietnamese stock market data
- **Domain:** Vietnam equities market data ingestion and synchronization within the `k/stock` domain

## Project Structure

- `shared/common/` — framework-agnostic DTOs and error base classes
- `shared/quarkus-base/` — Quarkus filters, exception mappers, reactive-event runtime, logging helpers
- `packages/base/` — reusable domain services (Slack client + flood-control effect)
- `packages/stock/` — stock info ingestion, messaging, schedulers, REST controllers, and trading analytics
- `projects/http/` — runnable Quarkus app bundling all modules, Flyway migrations, Dockerfiles, and dev/testing endpoints
- `settings.gradle` — declares the multi-project build (`shared:*`, `packages:*`, `projects:http`)

## Public Surface (Inbound)

- **Stock Registry:** `GET/POST /stocks` — list stocks, trigger Vietstock sync
- **Price History:** `GET/POST /prices` — query price history, trigger FireAnt sync
- **Tick Capture:** `GET/POST /ticks` — query tick data, trigger Simplize sync (targeted or all-symbol)
- **Trading Analytics:** `GET/POST /stock-trading` — view analyses, enqueue analytics jobs via RabbitMQ
- **Health/Dev:** `GET /private/info` (build metadata), `/hello/slack` (Slack test)
- **RabbitMQ consumers:** `stock-info-consumer` (stock/price/tick sync commands), `analysis-consumer` (trading analysis commands)

## Core Services & Logic (Internal)

- **ReactiveEventManager:** Shared runtime that registers all `@Effect` handlers at startup, forwarding `ReactiveEventAction`s over a Vert.x event bus with bounded concurrency and correlation propagation
- **StockInfoStockEffect / StockInfoPriceSyncEffect / StockInfoTickSyncEffect:** Declare pipeline steps as reactive actions; handle page-based Vietstock ingestion, paginated FireAnt price batching, and Simplize tick fan-out
- **StockTradingAnalysisService:** Pulls recent prices, computes rolling trade values and foreign buy/sell deltas, and upserts via MapStruct
- **CorrelatedMessageStore:** Tracks correlation IDs for Rabbit messages; effects ack/nack after processing
- **StockInfoSyncStatusService:** Persists completed sync windows for resumable runs
- **BaseSlackEffect / SlackService:** Buffers high-volume errors, batches Slack alerts to avoid flooding operators
- **VietstockCredentialsService:** Cookie-based auth with CSRF, hourly cache refresh, up to 3 retries

## External Dependencies & Contracts (Outbound)

- **PostgreSQL + Flyway:** Configured in `projects/http/src/main/resources/application.properties`; schema in `V1.0.0__http.sql` (stock_info_*, stock_trading_* tables)
- **RabbitMQ:** `stock-info-publisher/consumer` (exchange `jmeta.stock.info`, manual ack, max 4 outstanding), `analysis-publisher/consumer` (exchange `jmeta.stock.trading.analysis`, auto-ack)
- **Slack webhook:** `SlackService` expects `slack.url` + `slack.token` config; decorates with app/env metadata
- **Vietstock portal:** Form POST to `/data/corporateaz`, cookie + CSRF auth; credentials from env vars `STOCK_VIETSTOCK_EMAIL` / `STOCK_VIETSTOCK_PASSWORD`
- **FireAnt REST:** Bearer token auth (`application.properties:49-55`); retries 3x; scales prices to int storage format
- **Simplize API:** `GET /api/historical/ticks/{symbol}`; expects `[epochSeconds, price, volume, ...]` arrays; 5s connect / 15s read timeouts
