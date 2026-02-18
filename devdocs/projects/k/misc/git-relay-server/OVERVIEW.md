## Metadata Header
> **Branch:** main
> **Last Commit:** c988bde
> **Last Updated:** 2026-02-18T13:05:51+07:00

## Title & TL;DR
`git-relay-server` is the backend execution engine for relay-based Git patch delivery. It receives encrypted transport payloads, reconstructs patch sessions, applies patches to target repositories, and pushes results to GitHub.

## Recent Changes Log (Only if Updating)
Initial documentation.

## Repo Purpose & Bounded Context
- **Role:** Secure relay execution service that converts uploaded chunk sessions into Git operations.
- **Domain:** Developer tooling, private-network outbound code synchronization, and patch-based Git automation.

## Project Structure
- `src/index.ts`
  - Process entrypoint. Validates env config, loads app config, and starts HTTP server.
- `src/server.ts`
  - Express app composition, auth middleware, transport decryption middleware, route mounting, and global error handling.
- `src/routes/`
  - `health.ts`: Liveness endpoint.
  - `data.ts`: Generic data transport endpoints (chunk upload, complete signal, status polling).
  - `gr.ts`: Git Relay processing trigger endpoint.
- `src/services/`
  - `crypto.ts`: AES-256-GCM payload decryption and binary frame parsing.
  - `session-store.ts`: Session metadata, chunk persistence, status transitions, and TTL cleanup.
  - `repo-manager.ts`: Repo lifecycle management (clone/fetch/checkout) with per-repo locking.
  - `git.ts`: Patch apply and branch push operations.
- `src/lib/`
  - `config.ts`: Environment contract and app config loading.
  - `types.ts`: Request/response and session state types.
  - `errors.ts`: Domain-specific error taxonomy.
  - `express.d.ts`: Express request augmentation for `binaryData`.

## Controllers & Public Surface (Inbound)
- **Health**
  - `GET /health`: Returns server status and timestamp.
- **Transport API (authenticated via `X-Server-Key`)**
  - `POST /api/data/chunk`: Accepts encrypted metadata plus raw chunk bytes (after decrypt middleware).
  - `POST /api/data/complete`: Marks session upload complete.
  - `GET /api/data/status/:sessionId`: Returns session state and details.
- **Git Relay API (authenticated via `X-Server-Key`)**
  - `POST /api/gr/process`: Triggers async patch processing for a completed session.

## Core Services & Logic (Internal)
- **Request pipeline in `server.ts`**
  - Enforces API key auth first.
  - Decrypts `gameData` transport payloads into metadata (`req.body`) and optional binary data (`req.binaryData`).
  - Dispatches to transport or GR route handlers.
- **`SessionStore`**
  - Maintains lifecycle: `receiving -> complete -> processing -> pushed|failed`.
  - Writes chunk binaries to `/tmp/relay-sessions/<sessionId>/`.
  - Reassembles chunk files before Git processing.
  - Performs periodic TTL cleanup.
- **`createDataRouter`**
  - Validates chunk/complete/status inputs.
  - Persists chunk bodies and updates session state.
- **`createGRRouter`**
  - Validates processing request (`sessionId`, `repo`, `branch`, `baseBranch`).
  - Ensures session is ready for processing.
  - Executes reassemble -> repo prepare -> `git am` -> push -> status update.
- **`RepoManager` and `withRepoLock`**
  - Serializes work per target repo key.
  - Clones/fetches and checks out target branch from base branch.
- **`applyPatch` and `pushBranch`**
  - Applies mailbox patch with `git am --3way`.
  - Pushes using `--force-with-lease`.

## External Dependencies & Cross-Service Contracts (Outbound)
- **Databases:**
  - None.
- **Message Queues:**
  - None.
- **External APIs:**
  - GitHub Git over HTTPS using PAT (`https://x-access-token:<PAT>@github.com/<owner>/<repo>.git`) for clone/fetch/push operations.
- **Cross-service contracts:**
  - Receives encrypted transport payload from relay frontend.
  - Expects `X-Server-Key` on all `/api/*` routes.
  - Returns standardized JSON status/error payloads consumed by CLI via relay frontend.
