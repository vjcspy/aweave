## Metadata Header
> **Branch:** main
> **Last Commit:** f02d963
> **Last Updated:** 2026-02-18T13:05:51+07:00

## Title & TL;DR
`git-relay-vercel` is a Next.js relay frontend that disguises relay traffic under game-themed routes while forwarding authenticated requests to the private relay server. It also serves a Sudoku UI as the visible application surface.

## Recent Changes Log (Only if Updating)
Initial documentation.

## Repo Purpose & Bounded Context
- **Role:** Public-facing relay gateway and game-style facade for secure transport traffic.
- **Domain:** Developer tooling delivery edge, request forwarding, and frontend camouflage via a Sudoku app.

## Project Structure
- `src/app/`
  - `page.tsx`: Renders the Sudoku game root page.
  - `layout.tsx`: Global metadata, font setup, and shell layout.
  - `api/game/`: Route handlers for relay forwarding endpoints.
- `src/lib/forward.ts`
  - Shared forwarding logic: request authentication, header translation, server proxying, and error mapping.
- `src/lib/sudoku/`
  - Puzzle generation, solving, board validation, and Sudoku domain types/utilities.
- `src/components/sudoku/`
  - Stateful game UI and interaction components.
- `src/components/ui/`
  - Shared UI primitives used by the Sudoku page.

## Controllers & Public Surface (Inbound)
- **Web UI**
  - `GET /`: Sudoku game page (`SudokuGame`).
- **Relay API (authenticated via `X-Relay-Key`)**
  - `POST /api/game/chunk`: Forwards to server `/api/data/chunk`.
  - `POST /api/game/chunk/complete`: Forwards to server `/api/data/complete`.
  - `GET /api/game/chunk/status/:sessionId`: Forwards to server `/api/data/status/:sessionId`.
  - `POST /api/game/gr`: Forwards to server `/api/gr/process`.

## Core Services & Logic (Internal)
- **`forwardToServer` in `src/lib/forward.ts`**
  - Validates incoming relay key (`X-Relay-Key`).
  - Injects upstream auth header (`X-Server-Key`) for backend server.
  - Transparently forwards body and status/error payloads.
- **API route handlers in `src/app/api/game/**`**
  - Thin wrappers that map public game-themed routes to backend transport and GR routes.
- **Sudoku domain modules**
  - `generator.ts`: Randomized board generation with uniqueness checks.
  - `solver.ts`: Backtracking solver and solution counting.
  - `utils.ts` and `types.ts`: Board operations, conflict checks, and shared type contracts.
- **`SudokuGame` client component**
  - Orchestrates gameplay state, timer, hints, validation, and UI transitions.

## External Dependencies & Cross-Service Contracts (Outbound)
- **Databases:**
  - None.
- **Message Queues:**
  - None.
- **External APIs:**
  - Relay backend server defined by `SERVER_URL`, called over HTTP(S) from `forwardToServer`.
- **Cross-service contracts:**
  - Inbound from CLI and clients requires `X-Relay-Key`.
  - Outbound to backend uses `X-Server-Key`.
  - Forwards encrypted relay payloads as opaque JSON body content without decryption at this layer.
