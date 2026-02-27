---
name: Common Devtools Plans
description: Planning documents for domain-agnostic devtools work in `common`, including intent, scope, and execution status.
tags: [planning, devtools, common]
updated: 2026-02-27
folder_structure: "_plans/YYMMDD-kebab-case.md (flat, no subfolders)"
status_values: [new, in_progress, partial, done, abandoned]
category_values: []
tag_values: [memory, refactor, migration, cli, nestjs]
---

# Plans Topic (`_plans`)

> **Branch:** master
> **Last Commit:** 778a8b5
> **Last Updated:** 2026-02-27

## Purpose

This topic stores implementation plans for the `resources/workspaces/devtools/common` scope.
Create a new plan before substantial implementation or refactor work that needs explicit scope, phases, and traceable outcomes.
Entries can be authored by human contributors or AI agents.

## File Organization

- Structure is flat: files are stored directly under `_plans/` (no subfolders).
- File naming convention: `YYMMDD-kebab-case.md`.
- Each plan file contains YAML front-matter followed by markdown body sections.
- `OVERVIEW.md` is the convention reference for this topic.

## Front-matter Schema

- `name` (string, required): Human-readable plan title.
- `description` (string, required): One or two sentence summary of the plan.
- `status` (string, required): `new` | `in_progress` | `partial` | `done` | `abandoned`.
- `created` (YYYY-MM-DD, required): Plan creation date.
- `updated` (YYYY-MM-DD, optional): Last status-change date.
- `tags` (string[], optional): Search and filtering tags.

## Status Values

| Status | Meaning |
|---|---|
| `new` | Plan created, work not started |
| `in_progress` | Actively being implemented |
| `partial` | Some scope delivered, remaining work exists |
| `done` | Fully implemented |
| `abandoned` | Intentionally not continued |

## Category Values

No `category` field is currently used in this topic.

## Common Tags

Current plan files in this scope mostly use `tags: []`.
When tags are needed, use concise technical tags (for example: `memory`, `refactor`, `migration`, `cli`, `nestjs`).
