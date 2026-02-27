---
name: Common Devtools Architecture
description: Architecture documents for shared devtools design decisions, patterns, and long-lived structural guidance.
tags: [architecture, devtools, common]
updated: 2026-02-27
folder_structure: "_architecture/*.md (flat topic; OVERVIEW.md is the convention source)"
status_values: []
category_values: []
tag_values: [architecture, devtools, common]
---

# Architecture Topic (`_architecture`)

> **Branch:** master
> **Last Commit:** 778a8b5
> **Last Updated:** 2026-02-27

## Purpose

This topic stores architecture-focused documents that explain structural patterns, design rationale, and system behavior choices.
Create a new entry when introducing or revising a foundational architecture pattern that affects multiple components.
Entries can be authored by human contributors or AI agents.

## File Organization

- Structure is currently flat: files are stored directly under `_architecture/`.
- Filenames are descriptive titles (spaces are currently used in existing files).
- Prefer stable, readable filenames for long-lived references.
- `OVERVIEW.md` is the convention reference for this topic.

## Front-matter Schema

Front-matter is currently optional in this topic, but recommended for better T0 retrieval quality.

Recommended fields:
- `name` (string, optional): Architecture document title.
- `description` (string, optional): One or two sentence summary.
- `tags` (string[], optional): Search and filtering tags.
- `updated` (YYYY-MM-DD, optional): Last meaningful revision date.
- `created` (YYYY-MM-DD, optional): Initial creation date.

## Status Values

No `status` field is currently used in this topic.

## Category Values

No fixed `category` enum is currently used in this topic.

## Common Tags

No stable tag vocabulary is established yet for `_architecture/` in this scope.
