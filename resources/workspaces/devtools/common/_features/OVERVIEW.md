---
name: Common Devtools Features
description: Feature specifications for shared devtools capabilities in `common`, organized by area and used as capability-level reference.
tags: [features, devtools, common]
updated: 2026-02-27
folder_structure: "_features/<area>/<feature>.md (nested by area; currently only 'common')"
status_values: []
category_values: [common]
tag_values: [features, devtools, common]
---

# Features Topic (`_features`)

> **Branch:** master
> **Last Commit:** 778a8b5
> **Last Updated:** 2026-02-27

## Purpose

This topic stores feature-level documentation for shared devtools capabilities.
Create a new entry when introducing or redefining a capability, behavior contract, or end-to-end workflow.
Entries can be authored by human contributors or AI agents.

## File Organization

- Structure is nested by area: `_features/<area>/<feature>.md`.
- Existing example: `_features/common/debate.md`.
- File names should be descriptive and stable; date-prefix naming is not currently required here.
- `OVERVIEW.md` is the convention reference for this topic.

## Front-matter Schema

No required front-matter schema is currently enforced for `_features/` files in this scope.
Current tooling (`workspace-memory` feature scanner) derives feature identity from file path and filename.

Recommended front-matter for new files:
- `name` (string, optional): Human-readable feature name.
- `description` (string, optional): One or two sentence summary.
- `tags` (string[], optional): Search and filtering tags.
- `updated` (YYYY-MM-DD, optional): Last meaningful revision date.

## Status Values

No `status` field is currently used in this topic.

## Category Values

Category is represented by the first-level subfolder under `_features/` (for example `common`).
Valid category values are workspace-defined and can expand as new areas are added.

## Common Tags

No stable tag vocabulary is established yet for `_features/` in this scope.
