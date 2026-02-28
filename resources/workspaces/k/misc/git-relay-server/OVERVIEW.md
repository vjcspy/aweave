---
name: "Git Relay Server"
description: "Node.js/Express backend execution engine for relay-based Git patch delivery: receives encrypted transport payloads, reconstructs chunk sessions, applies patches to target repositories via git am, and pushes results to GitHub."
tags: [nodejs, express, git, relay, typescript, devtools]
updated: 2026-02-28
---

> **Branch:** workspaces/k
> **Last Commit:** c0dcbca
> **Last Updated:** 2026-02-28

## TL;DR

`git-relay-server` is the backend execution engine for relay-based Git patch delivery. It receives encrypted transport payloads, reconstructs patch sessions, applies patches to target repositories, and pushes results to GitHub via PAT-authenticated HTTPS.

## Repo Purpose & Bounded Context

- **Role:** Secure relay execution service that converts uploaded chunk sessions into Git operations (`git am --3way` + `git push --force-with-lease`)
- **Domain:** Developer tooling, private-network outbound code synchronization, and patch-based Git automation within the `k/misc` domain

## Project Structure

- `src/index.ts` — process entrypoint; validates env config, loads app config, starts HTTP server
- `src/server.ts` — Express app composition, auth middleware, transport decryption middleware, route mounting, global error handling
- `src/routes/`
  - `health.ts` — liveness endpoint
  - `data.ts` — generic data transport endpoints (chunk upload, complete signal, status polling)
  - `gr.ts` — Git Relay processing trigger endpoint
- `src/services/`
  - `crypto.ts` — AES-256-GCM payload decryption and binary frame parsing
  - `session-store.ts` — session metadata, chunk persistence, status transitions, TTL cleanup
  - `repo-manager.ts` — repo lifecycle management (clone/fetch/checkout) with per-repo locking
  - `git.ts` — patch apply and branch push operations
- `src/lib/`
  - `config.ts` — environment contract and app config loading
  - `types.ts` — request/response and session state types
  - `errors.ts` — domain-specific error taxonomy

## Public Surface (Inbound)

- **Health:** `GET /health` — returns server status and timestamp
- **Transport API** (authenticated via `X-Server-Key`)**:**
  - `POST /api/data/chunk` — accepts encrypted metadata + raw chunk bytes (after decrypt middleware)
  - `POST /api/data/complete` — marks session upload complete
  - `GET /api/data/status/:sessionId` — returns session state and details
- **Git Relay API** (authenticated via `X-Server-Key`)**:**
  - `POST /api/gr/process` — triggers async patch processing for a completed session

## Core Services & Logic (Internal)

- **Request pipeline (`server.ts`):** API key auth first → AES-256-GCM decrypt `gameData` transport payloads → dispatch to transport or GR route handlers
- **SessionStore:** Manages lifecycle `receiving → complete → processing → pushed|failed`; writes chunk binaries to `/tmp/relay-sessions/<sessionId>/`; reassembles chunks before Git processing; periodic TTL cleanup
- **RepoManager / withRepoLock:** Serializes work per target repo key; clones/fetches and checks out target branch from base branch
- **applyPatch / pushBranch:** Applies mailbox patch with `git am --3way`; pushes using `--force-with-lease`

## External Dependencies & Contracts (Outbound)

- **Databases:** None
- **Message Queues:** None
- **External APIs:** GitHub Git over HTTPS using PAT (`https://x-access-token:<PAT>@github.com/<owner>/<repo>.git`) for clone/fetch/push
- **Cross-service contracts:** Receives encrypted transport payloads from `git-relay-vercel` (relay frontend); expects `X-Server-Key` on all `/api/*` routes; returns standardized JSON status/error payloads consumed by CLI via relay frontend
