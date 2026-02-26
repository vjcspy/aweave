---
name: Workspace Memory
description: Pure TypeScript core library for workspace-scoped context retrieval — filesystem scanning, front-matter parsing, folder structure generation, and topic-based resource discovery with zero framework dependencies
tags: [memory, core, workspace, context]
---

# Workspace Memory (`@hod/aweave-workspace-memory`)

> **Branch:** master
> **Last Commit:** 2b6635f
> **Last Updated:** 2026-02-26

## TL;DR

Core library that powers the `workspace_get_context` tool. Scans `resources/workspaces/{scope}/` to assemble structured context: folder structure, OVERVIEW.md T0 summaries, loaded skills, and topic-specific data from `_{topicName}/` folders. Pure TypeScript with zero framework dependencies — consumed by NestJS, CLI, and MCP layers.

## Recent Changes Log

Initial Documentation — package created as part of Long-term Memory Phase 1 implementation.

## Repo Purpose & Bounded Context

- **Role:** Context assembly engine for the workspace memory system (L2 warm memory)
- **Domain:** Developer tooling — AI agent context infrastructure

## Project Structure

```
workspace-memory/
├── package.json               # @hod/aweave-workspace-memory
├── tsconfig.json
└── src/
    ├── index.ts               # Barrel exports
    ├── get-context/
    │   ├── get-context.ts     # Orchestrator — routes topics to handlers
    │   ├── defaults.ts        # Folder structure + T0 summaries + skills
    │   ├── types.ts           # Scope, GetContextParams, GetContextResponse, etc.
    │   └── topics/
    │       ├── features.ts    # Special handler for _features/ structure
    │       └── resource.ts    # Generic handler for any _{topicName}/ folder
    ├── parsers/
    │   ├── front-matter.ts    # YAML front-matter extraction from markdown
    │   └── folder-structure.ts # Directory tree generation with depth limits
    └── shared/
        ├── scope.ts           # Scope resolution (workspace/domain/repo → paths)
        └── paths.ts           # Path construction helpers
```

## Public Surface (Inbound)

- **`getContext(projectRoot, params)`** — Main entry point. Accepts scope, topics, includeDefaults, and filters. Returns assembled context response.
- **`resolveScope(projectRoot, scope)`** — Resolve workspace/domain/repo to filesystem paths
- **`validateResourcesDir(resolved)`** — Check that resources directory exists
- **`parseFrontMatter(content)`** — Extract YAML front-matter from markdown content
- **`generateFolderStructure(dir, options)`** — Generate tree representation of a directory

## Core Services & Logic (Internal)

- **Defaults assembler (`defaults.ts`):** Generates folder structure tree, scans all OVERVIEW.md files for T0 front-matter (name, description, tags), loads skill entries from `.aweave/loaded-skills.yaml`
- **Topic routing (`get-context.ts`):** 2-category system — `features` topic gets special handling via `scanFeatures()`, all other topics use generic `scanResourceTopic()` which scans `_{topicName}/` folders
- **Generic resource scanner (`resource.ts`):** Scans `_{topicName}/**/*.md`, extracts front-matter, applies status/tag/category filters, returns sorted entries with `_meta.document_path`
- **Features scanner (`features.ts`):** Scans `_features/**/*.md`, derives feature names from path structure
- **Scope resolution (`scope.ts`):** Maps `{ workspace, domain?, repository? }` to `resources/workspaces/{workspace}[/{domain}[/{repo}]]` paths

## External Dependencies & Contracts (Outbound)

- **`yaml`** — YAML parsing for front-matter extraction
- **`fast-glob`** — File pattern scanning for OVERVIEW.md, `_{topicName}/` contents
- **Filesystem:** Reads `resources/workspaces/` and `.aweave/loaded-skills.yaml` relative to project root

## Related

- **NestJS Module:** `workspaces/devtools/common/nestjs-workspace-memory/`
- **CLI Plugin:** `workspaces/devtools/common/cli-plugin-workspace/`
- **Feature Spec:** `resources/misc/workflow-optimization/_features/core/long-term-memory.md`
- **Implementation Plan:** `resources/misc/workflow-optimization/_plans/260225-long-term-memory-phase1.md`
