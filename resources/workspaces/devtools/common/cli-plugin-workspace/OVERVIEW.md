---
name: Workspace CLI Plugin
description: oclif plugin providing workspace management commands — context retrieval and hot memory rule building, calling core library directly without server roundtrip
tags: [memory, cli, workspace, context, hot-memory]
---

# Workspace CLI Plugin (`@hod/aweave-plugin-workspace`)

> **Branch:** master
> **Last Commit:** (local changes)
> **Last Updated:** 2026-02-27

## TL;DR

oclif plugin providing `aw workspace` commands for context retrieval, rule building, and local MCP STDIO entrypoint. Calls core libraries directly (no server roundtrip). Key commands include `build-rules` for hot memory rule composition and `mcp` for running workspace-memory tools over STDIO.

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
            ├── build-rules.ts              # aw workspace build-rules
            └── mcp.ts                      # aw workspace mcp
```

## Public Surface (Inbound)

- **`aw workspace get-context`** — Retrieve workspace context (folder structure, overviews, topic data)
  - Flags: `--workspace` (required), `--domain`, `--repository`, `--topics`, `--no-defaults`, `--filter-status`, `--filter-tags`, `--filter-category`, `--format`
- **`aw workspace build-rules`** — Combine hot memory source files into a single `AGENTS.md`
  - Flags: `--project-root`, `--dry-run`, `--format`
  - Sources: `agent/rules/common/user-profile.md`, `global-conventions.md`, `workspace-workflow.md`, `context-memory-rule.md`
  - Output: `AGENTS.md` at project root with `generated_from` front-matter
- **`aw workspace mcp`** — Start Workspace Memory MCP server via STDIO
  - Flags: `--project-root` (optional, absolute path)
  - Root resolution order: explicit `--project-root` → `resolveProjectRootFromDevtools()` (`AWEAVE_DEVTOOLS_ROOT`/`cwd`/`moduleDir`) → fail-fast with remediation error

## Core Services & Logic (Internal)

- **get-context command:** Resolves project root via `resolveDevtoolsRoot()` (from `@hod/aweave-node-shared`), calls core `getContext()` directly, outputs result in MCPResponse format
- **build-rules command:** Reads hot memory source files, strips budget comments, shifts heading levels (H1→H2, H2→H3), combines with front-matter, writes to `AGENTS.md`
- **mcp command:** Creates workspace-memory MCP server and binds `StdioServerTransport` for local AI clients
- **Project root resolution:** Uses `resolveProjectRootFromDevtools()` from `@hod/aweave-node-shared` for deterministic root discovery

## External Dependencies & Contracts (Outbound)

- **`@hod/aweave-workspace-memory`** — Core context retrieval (called directly)
- **`@hod/aweave-mcp-workspace-memory`** — MCP server factory for workspace tools
- **`@hod/aweave-cli-shared`** — MCPResponse, output helpers, ContentType
- **`@hod/aweave-node-shared`** — root discovery helpers (`resolveDevtoolsRoot`, `resolveProjectRootFromDevtools`)
- **`@modelcontextprotocol/sdk`** — STDIO transport implementation
- **`@oclif/core`** — CLI framework
- **Filesystem:** Reads `agent/rules/common/*.md`, writes `AGENTS.md`

## Related

- **Core Library:** `workspaces/devtools/common/workspace-memory/`
- **NestJS Module:** `workspaces/devtools/common/nestjs-workspace-memory/`
- **Hot Memory Sources:** `agent/rules/common/user-profile.md`, `global-conventions.md`, `workspace-workflow.md`, `context-memory-rule.md`
- **Implementation Plan:** `resources/misc/workflow-optimization/_plans/260225-long-term-memory-phase1.md`
