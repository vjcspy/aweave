---
name: Dashboard Web
description: DevTools Dashboard frontend SPA built with React and Rsbuild for managing developer configurations
tags: []
---

## Metadata Header
>
> **Branch:** master
> **Last Commit:** c27d11e
> **Last Updated:** Sun Feb 22 22:01:21 2026 +0700

## Title & TL;DR

DevTools Dashboard frontend SPA built with React and Rsbuild, providing a premium UI for managing developer configurations and toggling AI agent skills.

## Repo Purpose & Bounded Context

- **Role:** Web User Interface for DevTools Dashboard
- **Domain:** Developer Tools

## Project Structure

- `src/App.tsx`: Main application layout with Tab navigation (Configs vs. Agent Skills)
- `src/components/`: Core UI Views
  - `ConfigsView.tsx`: Interface to view and edit configurations
  - `SkillsView.tsx`: Interface to read and toggle loaded AI skills
- `src/lib/`: API clients leveraging `openapi-fetch` and generated TypeScript types from the backend OpenAPI schema.
- `rsbuild.config.ts`: React framework setup utilizing TailwindCSS v4 and PostCSS.

## Controllers & Public Surface (Inbound)

- **Static Assets:**
  - Served via `@hod/aweave-server` fallback route (`/dashboard/*`) on port 3456.

## Core Services & Logic (Internal)

- **API Client:** Uses `openapi-fetch` pointing to `/openapi.json` to strongly type the backend API endpoints.
- **State Management:** Local React state for toggling between the Configs and Agent Skills tabs, and handling component-level data fetching.

## External Dependencies & Cross-Service Contracts (Outbound)

- **External APIs:** Calls `@hod/aweave-nestjs-dashboard` backend endpoints for both configuration data and agent skill states.
