---
name: Relay CLI Plugin
description: oclif plugin for pushing Git bundles and files to GitHub through a Vercel-hosted relay server with encrypted chunk transport (X25519 + AES-256-GCM)
tags: [cli, relay, git, encryption]
---

# Relay CLI Plugin (`@hod/aweave-plugin-relay`)

> **Branch:** master
> **Last Commit:** 2b6635f
> **Last Updated:** 2026-02-26

## TL;DR

oclif plugin providing `aw relay` commands for pushing Git commits and files to GitHub via a Vercel-hosted relay server. Designed for environments where direct Git access is restricted. All payloads are encrypted with X25519 key exchange + AES-256-GCM.

## Recent Changes Log

Initial Documentation.

## Repo Purpose & Bounded Context

- **Role:** CLI interface for relay-based Git and file transport
- **Domain:** Developer tooling — secure remote code transport

## Project Structure

```
cli-plugin-relay/
├── package.json                                  # @hod/aweave-plugin-relay
├── tsconfig.json
└── src/
    ├── index.ts                                  # (empty — oclif auto-discovers)
    ├── commands/
    │   └── relay/
    │       ├── push.ts                           # aw relay push (git bundle)
    │       ├── status.ts                         # aw relay status <sessionId>
    │       ├── file/
    │       │   └── push.ts                       # aw relay file push
    │       └── config/
    │           ├── set.ts                        # aw relay config set
    │           ├── show.ts                       # aw relay config show
    │           └── import-public-key.ts          # aw relay config import-public-key
    └── lib/
        ├── relay-client.ts                       # HTTP client with retries + polling
        ├── chunker.ts                            # Payload chunking (64KB–3.4MB)
        ├── crypto.ts                             # X25519, AES-256-GCM, HKDF
        └── config.ts                             # ~/.aweave/relay.json management
```

## Public Surface (Inbound)

- **`aw relay push`** — Create Git bundle from local commits, encrypt, chunk, upload via relay, trigger GitHub push
  - Flags: `--repo`, `--branch`, `--base`, `--chunk-size`, `--format`
- **`aw relay status <sessionId>`** — Poll relay session status until `pushed`/`stored` or `failed`
- **`aw relay file push`** — Upload arbitrary file via encrypted chunk transport
  - Flags: `--file`, `--name`, `--wait`/`--no-wait`, `--chunk-size`, `--format`
- **`aw relay config set`** — Update relay config values
  - Flags: `--relay-url`, `--api-key`, `--server-key-id`, `--server-public-key`, `--chunk-size`, `--base-branch`
- **`aw relay config show`** — Display current config (sensitive values masked)
- **`aw relay config import-public-key`** — Import and pin server public key for v2 transport

## Core Services & Logic (Internal)

- **Relay client (`relay-client.ts`):** HTTP calls to relay API with retry logic and exponential backoff. Handles chunk upload, completion signaling, Git Relay triggering, and status polling.
- **Chunker (`chunker.ts`):** Splits payloads into chunks (64KB–3.4MB) respecting Vercel's 4.5MB body limit
- **Crypto (`crypto.ts`):** v2 transport — ephemeral X25519 key exchange, HKDF-derived content key, AES-256-GCM encryption
- **Config (`config.ts`):** Manages `~/.aweave/relay.json` with relay URL, API key, server public key, and transport settings

## External Dependencies & Contracts (Outbound)

- **`@hod/aweave-cli-shared`** — MCPResponse, output helpers
- **Vercel Relay API** — `POST /api/game/chunk`, `POST /api/game/chunk/complete`, `POST /api/game/gr`, `GET /api/game/remote-info`, `GET /api/game/chunk/status/:sessionId`
- **Node.js `crypto`** — X25519, AES-256-GCM, HKDF, SHA256
- **Node.js `child_process`** — Git bundle creation, remote queries

## Related

- **Main CLI:** `workspaces/devtools/common/cli/`
- **Shared Utilities:** `workspaces/devtools/common/cli-shared/`
