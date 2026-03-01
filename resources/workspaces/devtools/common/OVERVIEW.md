---
name: "Common Devtools"
description: "Domain-agnostic shared platform infrastructure providing CLI framework, libraries, state machines, unified backend server, and generic UI components."
tags: ["cli-core", "shared", "platform", "infrastructure"]
---

> **Branch:** master
> **Last Commit:** 63b45a9
> **Last Updated:** Sun Mar 1 13:51:11 2026 +0700

## TL;DR

The Common Devtools domain is the foundational platform for the `aw` CLI ecosystem. It abstracts away common complexity—such as CLI composition, logging, server daemon lifecycle, database storage, and AI agent mechanics (debate and workflow)—so that other specific business domains (like NAB) can focus purely on domain logic.

## Domain Context

- **Business Context:** Provides the shared underlying toolset, web dashboard infrastructure, state machines, and server architectures used universally across all `aw` packages.
- **Relationship to Other Domains:** Acts as the lower-level foundation. All other domains natively consume the `cli`, `cli-shared`, `node-shared`, and `nestjs-core` components from this domain.

## Cross-Repo Patterns

- **CLI Composition:** The main entrypoint connects independent domain plugins using `oclif`. Plugins are auto-loaded and utilize `cli-shared` for a consistent MCP response format and logging (`getCliLogger`).
- **Unified Server:** A single NestJS process serving all APIs (REST, Websocket) on port 3456. Sub-domains build their NestJS modules, which the global server coordinates.
- **Structured JSON Logging:** Consistent use of `nestjs-core` for server logging and `node-shared` for rotation, ensuring both JSONL persisted data and MCP-safe stdio interactions via `stderr`.
- **State Machines:** Reusable xstate v5 machines define flows for debates and workflows, shared across server verifications and frontend render logic.
- **Frontend Architecture:** Next.js and Rsbuild (React SPA) instances served as identical-origin SPA fallbacks off the `aweave-server` API daemon.
- **Browser Automation:** Shared integration leveraging local system browsers via `playwright-core`.

## Domain-Specific Development

- **No Domain Logic:** Packages here must remain business-agnostic. Specific workflow configurations, endpoint business rules, or arbitrary third-party client integrations belong in sibling domains.
- **Backward Compatibility:** Because `cli-shared` serves as the core MCP contract for AI agents, altering the structured outputs or process manager behaviors should be done defensively.
- **Core Integrations:** When introducing a new cross-cutting concern (like a new database or message queue), it is instrumented here and exposed to domain plugins, preserving uniform dependency control.
