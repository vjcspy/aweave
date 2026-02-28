---
name: "K Workspace"
description: "Personal workspace grouping stock market analytics projects and misc developer utility services for Vietnamese equities markets and outbound code synchronization tooling."
tags: [stock, vietnam, personal, devtools]
updated: 2026-02-28
---

> **Branch:** workspaces/k
> **Last Commit:** c0dcbca
> **Last Updated:** 2026-02-28

## TL;DR

The `k` workspace is a personal project workspace focused on building a Vietnamese stock market analytics platform. It contains a `stock` domain (multi-repo: Quarkus backend, Python feature pipeline, Next.js dashboard) and a `misc` domain with supporting developer utilities (git relay server/vercel).

## Purpose & Bounded Context

- **Role:** Personal project workspace for stock trading analytics and developer tooling
- **Domain:** Vietnamese equities intraday analytics (VN30, HSX/HNX markets) and private-network code synchronization utilities

## Design Philosophy

- Domain-organized structure: each domain (`stock`, `misc`) groups related repositories
- Data pipeline separation: ingestion (`jmeta`), feature engineering (`metan`), and UI (`meta`) are distinct repos with clear boundaries
- End-to-end ownership: from raw market tick data to AI-model-ready feature sets

## Architecture Overview

- **stock domain:** `jmeta` (Quarkus ingestion/API) → `metan` (Python feature pipeline) → `meta` (Next.js dashboard)
- **misc domain:** `git-relay-server` (backend execution engine) ↔ `git-relay-vercel` (Next.js relay frontend/facade)

Data flows from Vietnamese market data providers (Vietstock, FireAnt, Simplize) through Quarkus REST/RabbitMQ ingestion into PostgreSQL and Supabase, then through Python feature pipelines to produce AI-ready VN30 feature candles, visualized in the Next.js dashboard.

## Development Approach

- Use `workspace_get_context` with `workspace=k` to get orientation across the workspace
- To work on a specific domain, scope to `domain=stock` or `domain=misc`
- To work on a specific repo, scope to `repository=metan`, `repository=jmeta`, etc.

## Quick Reference

- Stock backend: `workspaces/k/stock/jmeta` (Quarkus/Gradle multi-module)
- Feature pipeline: `workspaces/k/stock/metan` (Python, uv workspace)
- Stock dashboard: `workspaces/k/stock/meta` (Next.js, pnpm)
- Git relay backend: `workspaces/k/misc/git-relay-server` (Node.js/Express)
- Git relay frontend: `workspaces/k/misc/git-relay-vercel` (Next.js/Vercel)
