---
name: "DevTools"
description: "Unified TypeScript monorepo workspace providing CLI, server, and frontend architecture for local development infrastructure."
tags: ["cli", "server", "frontend", "monorepo"]
---

> **Branch:** master
> **Last Commit:** 63b45a9
> **Last Updated:** Sun Mar 1 13:51:11 2026 +0700

## TL;DR

Unified TypeScript monorepo with a single CLI entrypoint `aw <command>`. All tools built with Node.js: CLI (oclif), server (NestJS), frontend (React SPA via Rsbuild). Organized with a domain-first folder structure, pnpm workspaces for package management, and a centralized NestJS server.

## Purpose & Bounded Context

- **Role:** Provide a unified CLI toolset and backend services for the entire development workflow.
- **Domain:** Developer Experience, Automation, Local Development Infrastructure.

## Design Philosophy

1. **Single Entrypoint** — All tools accessed via `aw <command>`.
2. **Domain-First Organization** — Folder structure by domain, not by tool type.
3. **TypeScript Everywhere** — CLI, server, frontend — all TypeScript.
4. **Plugin Systems** — Each domain ships commands as an oclif plugin, auto-discovered at startup. Backends are NestJS modules imported by a single unified server.
5. **Single Process, Single Port** — NestJS server serves REST API, WebSocket, and static SPA on port 3456.
6. **npm Publishable** — All packages published to `@hod/` scope, installable via `npx` or globally.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Terminal / AI Agent                 │
│                         │                                   │
│           npx @hod/aweave server start --open               │
│                         │                                   │
│  ┌──────────────────────┴──────────────────────┐            │
│  │              @hod/aweave (oclif)            │            │
│  │    Discover & route to Domain Plugins       │            │
│  └───────┬──────────────┬──────────────────────┘            │
│          │              │                                   │
│          ▼              ▼                                   │
│  ┌───────────────┐  ┌─────────────────┐                     │
│  │ @hod/aweave-server │  │  External APIs  │                │
│  │   (NestJS)    │  │  (Bitbucket,    │                     │
│  │   port 3456   │  │   etc.)         │                     │
│  │ ┌───────────┐ │  └─────────────────┘                     │
│  │ │ Features  │ │                                          │
│  │ │ (Modules) │ │                                          │
│  │ └───────────┘ │                                          │
│  │ ┌───────────┐ │  Web SPAs served at specific endpoints   │
│  │ │ Web SPAs  │ │  (static HTML/JS/CSS, same-origin)       │
│  │ └───────────┘ │                                          │
│  └───────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
```

## Development Approach

- **Tooling:** Managed with `pnpm` workspaces from the `devtools/` root using `pnpm-workspace.yaml`.
- **Adding a CLI Plugin:** Create a new `@hod/aweave-plugin-<name>` package in the respective domain, add commands under the plugin's `src/commands/`, and register it in the main CLI entrypoint's dependencies and `oclif.plugins`.
- **Adding a Backend Feature:** Create a NestJS module package in the respective domain and import it into the unified backend server `@hod/aweave-server`.
- **Publishing:** All packages publish to `@hod/` under npm, handled through an automated `pnpm -r publish` approach resolving `workspace:*` references.

## Quick Reference

- **Install all:** `cd workspaces/devtools && pnpm install`
- **Build all:** `cd workspaces/devtools && pnpm -r build`
- **Run CLI (global if linked):** `aw <command>`
- **Run CLI (npx):** `npx @hod/aweave <command>`
- **Server commands:** `aw server start [--open]`, `aw server stop`, `aw server status`
