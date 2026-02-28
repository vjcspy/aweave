---
name: "Git Relay Vercel"
description: "Next.js relay frontend deployed on Vercel that disguises Git relay traffic under game-themed routes while forwarding authenticated requests to the private git-relay-server backend; also serves a Sudoku UI as the visible application surface."
tags: [nextjs, vercel, git, relay, typescript, devtools, sudoku]
updated: 2026-02-28
---

> **Branch:** workspaces/k
> **Last Commit:** c0dcbca
> **Last Updated:** 2026-02-28

## TL;DR

`git-relay-vercel` is a Next.js relay frontend that disguises relay traffic under game-themed routes while forwarding authenticated requests to the private relay server. It also serves a Sudoku UI as the visible application surface, providing plausible cover for the relay endpoints.

## Repo Purpose & Bounded Context

- **Role:** Public-facing relay gateway and game-style facade for secure transport traffic; deployed on Vercel as the outbound-safe edge
- **Domain:** Developer tooling delivery edge within the `k/misc` domain; pairs with `git-relay-server` as the backend execution engine

## Project Structure

- `src/app/` — Next.js App Router
  - `page.tsx` — renders the Sudoku game root page
  - `layout.tsx` — global metadata, font setup, shell layout
  - `api/game/` — route handlers for relay forwarding endpoints
- `src/lib/forward.ts` — shared forwarding logic: request auth, header translation, server proxying, error mapping
- `src/lib/sudoku/` — puzzle generation, solving, board validation, and Sudoku domain types/utilities
- `src/components/sudoku/` — stateful game UI and interaction components
- `src/components/ui/` — shared UI primitives used by the Sudoku page

## Public Surface (Inbound)

- **Web UI:** `GET /` — Sudoku game page (`SudokuGame`)
- **Relay API** (authenticated via `X-Relay-Key`)**:**
  - `POST /api/game/chunk` — forwards to server `/api/data/chunk`
  - `POST /api/game/chunk/complete` — forwards to server `/api/data/complete`
  - `GET /api/game/chunk/status/:sessionId` — forwards to server `/api/data/status/:sessionId`
  - `POST /api/game/gr` — forwards to server `/api/gr/process`

## Core Services & Logic (Internal)

- **`forwardToServer` (`src/lib/forward.ts`):** Validates incoming `X-Relay-Key`; injects upstream `X-Server-Key` for backend; transparently forwards body and status/error payloads
- **API route handlers (`src/app/api/game/**`):** Thin wrappers mapping public game-themed routes to backend transport and GR routes; no decryption at this layer
- **Sudoku domain modules:** `generator.ts` (randomized board generation with uniqueness checks), `solver.ts` (backtracking solver and solution counting), `utils.ts` / `types.ts` (board operations, conflict checks, shared types)
- **`SudokuGame` client component:** Orchestrates gameplay state, timer, hints, validation, and UI transitions

## External Dependencies & Contracts (Outbound)

- **Databases:** None
- **Message Queues:** None
- **External APIs:** `git-relay-server` backend defined by env `SERVER_URL`; called over HTTP(S) from `forwardToServer`
- **Cross-service contracts:**
  - Inbound from CLI and clients requires `X-Relay-Key`
  - Outbound to backend uses `X-Server-Key`
  - Forwards encrypted relay payloads as opaque JSON body content without decryption at this layer
