---
name: "Meta Stock Web"
description: "Next.js dashboard for Vietnamese stock market visualization: widgetized grid layout with draggable/resizable charts, Supabase-backed data queries, and localStorage-persisted user configuration."
tags: [nextjs, react, stock, dashboard, supabase, tailwind, vietnam]
updated: 2026-02-28
---

> **Branch:** workspaces/k
> **Last Commit:** c0dcbca
> **Last Updated:** 2026-02-28

## TL;DR

`meta` is the frontend experience for the `k/stock` platform. It provides a widgetized dashboard (`/dashboard`) built on `react-grid-layout`, with presentational chart components and data-aware container widgets querying Supabase for feature candle data. User widget configurations are persisted to `localStorage`.

## Repo Purpose & Bounded Context

- **Role:** Frontend visualization layer for stock analytics; read-only consumer of Supabase feature data
- **Domain:** `k/stock` — the presentation tier; receives data from `metan`'s feature pipeline via Supabase

## Project Structure

- `projects/stock/apps/web/` — app root (Next.js pages router)
  - `src/pages/_app.tsx` — global CSS imports for grid/resize
  - `src/pages/_document.tsx` — HTML shell
  - `src/pages/index.tsx` — landing page
  - `src/pages/dashboard.tsx` — dashboard grid (RGL) with Cards and charts
  - `src/styles/globals.css` — Tailwind base/theme and app styles
  - `src/components/ui/` — shadcn UI primitives only (no business logic)
  - `src/components/chart/` — presentational chart components (pure render, no fetch/persistence)
  - `src/components/dashboard/` — container widgets that fetch, map data, and wire UI
  - `src/lib/user-config.ts` — localStorage persistence utilities

## Public Surface (Inbound)

- **Web UI:** `GET /` (landing), `GET /dashboard` (main grid view)
- Dev server: `pnpm --filter @stock/apps-web dev` → `http://localhost:3000`

## Core Services & Logic (Internal)

- **Dashboard pattern:** `react-grid-layout` responsive grid, dynamically imported (SSR disabled); shadcn `Card` with draggable header (`.rgl-drag-handle`) and interactive `CardContent`
- **Component separation:** `src/components/chart/` = pure renderers; `src/components/dashboard/` = data-aware containers (handle Supabase queries, filter state, localStorage persistence)
- **User config persistence:** `getUserConfig`, `getUserConfigKey`, `putUserConfig(key, data)` from `src/lib/user-config.ts` — writes to `localStorage` key `user_config`; always accessed inside client effects (SSR safety)
- **Charts:** `react-chartjs-2` atop Chart.js; `maintainAspectRatio: false` for responsive sizing; zoom/pan disabled by default on intraday charts

## External Dependencies & Contracts (Outbound)

- **Databases:** Supabase (market feature candle data via `stock_trading_feature_candles` table)
- **Message Queues:** None
- **External APIs:** None (all data comes from Supabase)
- **Browser storage:** `localStorage` for user widget/filter preferences

## Conventions

- Use `es-toolkit` for utilities like `debounce`; avoid hand-rolled timing logic
- Apply drag handle on headers; cancel drag on interactive elements
- Adding a widget: define grid layout items per breakpoint in `dashboard.tsx`, create container in `src/components/dashboard/`, render chart from `src/components/chart/` in `CardContent`
