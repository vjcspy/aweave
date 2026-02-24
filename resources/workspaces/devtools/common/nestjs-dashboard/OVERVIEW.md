## Metadata Header
>
> **Branch:** master
> **Last Commit:** c27d11e
> **Last Updated:** Sun Feb 22 22:01:21 2026 +0700

## Title & TL;DR

NestJS backend module that exposes REST APIs to read/write workspace YAML configurations and manage the activation state of AI agent skills.

## Repo Purpose & Bounded Context

- **Role:** Backend API Module for the DevTools Dashboard
- **Domain:** Developer Tools

## Project Structure

- `src/controllers/`: Exposes HTTP entry points for configurations and skills.
- `src/services/`: Core logic wrapping file-system operations and `gray-matter` Markdown parsing.
- `src/dtos/`: Data Transfer Objects for swagger/OpenAPI generation.
- `src/dashboard.module.ts`: NestJS Module wiring controllers and services to be imported by the main `@hod/aweave-server`.

## Controllers & Public Surface (Inbound)

- **Configs Controller (`/configs`):**
  - Exposes endpoints to retrieve configuration schemas, read the effective vs raw configuration, and save config overrides.
- **Skills Controller (`/skills`):**
  - Exposes endpoints to retrieve a list of all parsed AI skills and mutate their active state.

## Core Services & Logic (Internal)

- **ConfigsService:** Interacts with the local file system and dependencies (`@hod/aweave-config-core`) to fetch domain variables and enforce validation when saving data to `aweave.config.yaml`.
- **SkillsService:** Scans directories (`agent/skills/` and `~/.aweave/skills/`) to parse `SKILL.md` frontmatter using `gray-matter`. Persists active skills for the current workspace in `<PROJECT_ROOT>/.aweave/loaded-skills.yaml` (single source of truth, YAML with absolute `skill_path` values) for AI Agent workflows.

## External Dependencies & Cross-Service Contracts (Outbound)

- **Databases/Persistence:** Uses the local filesystem directly to persist workspace YAML config and skill activation state.
- **Internal Workspace Packages:** Relies heavily on `@hod/aweave-config-core` for evaluating the effective configuration states.
