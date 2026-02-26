---
name: Workspace CLI Plugin
description: oclif plugin providing workspace management commands — context retrieval and hot memory rule building, calling core library directly without server roundtrip
tags: [memory, cli, workspace, context, hot-memory]
---

# Workspace CLI Plugin (`@hod/aweave-plugin-workspace`)

> **Branch:** master
> **Last Commit:** 2b6635f
> **Last Updated:** 2026-02-26

## TL;DR

oclif plugin providing `aw workspace` commands for context retrieval and rule building. Calls `@hod/aweave-workspace-memory` core library directly (no server roundtrip). Key command `build-rules` combines hot memory source files into the single `AGENTS.md` entry point.

## Recent Changes Log

Initial Documentation — package created as part of Long-term Memory Phase 1 implementation.

## Repo Purpose & Bounded Context

- **Role:** CLI interface for workspace memory operations and agent rule management
- **Domain:** Developer tooling — AI agent context infrastructure

## Project Structure

```
cli-plugin-workspace/
├── package.json                            # @hod/aweave-plugin-workspace
├── tsconfig.json
└── src/
    ├── index.ts                            # (empty — oclif auto-discovers commands)
    └── commands/
        └── workspace/
            ├── get-context.ts              # aw workspace get-context
            └── build-rules.ts              # aw workspace build-rules
```

## Public Surface (Inbound)

- **`aw workspace get-context`** — Retrieve workspace context (folder structure, overviews, topic data)
  - Flags: `--workspace` (required), `--domain`, `--repository`, `--topics`, `--no-defaults`, `--filter-status`, `--filter-tags`, `--filter-category`, `--format`
- **`aw workspace build-rules`** — Combine hot memory source files into a single `AGENTS.md`
  - Flags: `--project-root`, `--dry-run`, `--format`
  - Sources: `agent/rules/common/user-profile.md`, `global-conventions.md`, `workspace-workflow.md`, `context-memory-rule.md`
  - Output: `AGENTS.md` at project root with `generated_from` front-matter

## Core Services & Logic (Internal)

- **get-context command:** Resolves project root via `resolveDevtoolsRoot()` (from `@hod/aweave-node-shared`), calls core `getContext()` directly, outputs result in MCPResponse format
- **build-rules command:** Reads hot memory source files, strips budget comments, shifts heading levels (H1→H2, H2→H3), combines with front-matter, writes to `AGENTS.md`
- **Project root resolution:** Uses `resolveDevtoolsRoot()` + 2 levels up to reach monorepo root

## External Dependencies & Contracts (Outbound)

- **`@hod/aweave-workspace-memory`** — Core context retrieval (called directly)
- **`@hod/aweave-cli-shared`** — MCPResponse, output helpers, ContentType
- **`@hod/aweave-node-shared`** — `resolveDevtoolsRoot()` for path resolution
- **`@oclif/core`** — CLI framework
- **Filesystem:** Reads `agent/rules/common/*.md`, writes `AGENTS.md`

## Related

- **Core Library:** `workspaces/devtools/common/workspace-memory/`
- **NestJS Module:** `workspaces/devtools/common/nestjs-workspace-memory/`
- **Hot Memory Sources:** `agent/rules/common/user-profile.md`, `global-conventions.md`, `workspace-workflow.md`, `context-memory-rule.md`
- **Implementation Plan:** `resources/misc/workflow-optimization/_plans/260225-long-term-memory-phase1.md`
