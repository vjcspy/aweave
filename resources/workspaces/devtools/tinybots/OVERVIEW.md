---
name: "DevTools Tinybots"
description: "Domain-specific DevTools packages for the TinyBots workspace, providing CLI extensions and local development infrastructure for TinyBots engineers."
tags: ["tinybots", "devtools", "cli", "docker", "integration-testing"]
---

> **Branch:** workspaces/tinybots
> **Last Commit:** 114ae5b
> **Last Updated:** Fri Feb 27 09:31:44 2026 +0000

## TL;DR

TinyBots-specific tooling built on top of the shared DevTools common layer. Currently covers a Bitbucket CLI plugin for PR operations and a Docker Compose-based local dev infrastructure (devtools package) with `just` command orchestration and database seeding.

## Domain Context

- **Business Context:** TinyBots engineers need domain-specific tooling that goes beyond the shared `devtools/common` layer — Bitbucket PR workflows specific to TinyBots repos, and a centralised Docker Compose setup that mirrors TinyBots CI environments locally.
- **Relationship to Other Domains:** Sits alongside `devtools/common` (shared CLI, plugins, workspace-memory) within the broader `devtools` workspace. Packages here are TinyBots-only and are NOT intended for reuse across other domains (e.g., `nab`).

## Cross-Repo Patterns

- **Domain-specific CLI plugins:** Oclif plugins in this domain follow the same plugin contract as `devtools/common` plugins but are scoped with a `tinybots-*` topic prefix (e.g., `aw tinybots-bitbucket`).
- **Output format:** All CLI commands return `MCPResponse` JSON via `@aweave/cli-shared` helpers — consistent across common and domain plugins.
- **Local infra as code:** The devtools Docker Compose setup defines all databases, migrations, and shared services in a single `docker-compose.yaml`, mirroring the pattern used historically in per-repo CI configs.

## Domain-Specific Development

- **Adding a new domain plugin:** Create a new package at `workspaces/devtools/tinybots/cli-plugin-<name>/`, model it after `cli-plugin-bitbucket`. Register it in the monorepo `pnpm-workspace.yaml` and wire into the CLI via the root `cli/` package.
- **Local dev infrastructure:** Managed separately from the monorepo build system. See the devtools package for `just` commands and Docker Compose workflows.
- **ECR auth required:** Application service images (typ-e, wonkers, checkpoint, etc.) are hosted in AWS ECR (`693338167548.dkr.ecr.eu-central-1.amazonaws.com`). Run `tinybots:ecr` before pulling images.
