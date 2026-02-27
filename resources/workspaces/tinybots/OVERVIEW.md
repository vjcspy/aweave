---
name: "TinyBots"
description: "Backend services, frontend apps, and Wonkers integrations for robot telemetry ingestion, automation scheduling, TaaS order lifecycle, and customer/admin dashboards."
tags: [telemetry, automation, taas, robots, nodejs, typescript]
updated: 2026-02-27
---

> **Branch:** workspaces/tinybots
> **Last Commit:** 1b17460
> **Last Updated:** 2026-02-27

## TL;DR

TinyBots is a multi-service platform that ingests robot telemetry, evaluates status, schedules automation, and manages TaaS order flows. Backend services are Node.js/TypeScript (Yarn); schema repos use Java/Maven. Frontend apps are React/TypeScript with npm. The workspace is organized into `backend/` and `frontend/` domains.

## Purpose & Bounded Context

- **Role:** End-to-end platform for Tessa robot operations — from telemetry ingestion through automation to customer-facing dashboards
- **Domain:** IoT robot management, telemetry processing, TaaS (Tessa-as-a-Service) order lifecycle

## Design Philosophy

- **Event-driven architecture:** Robot telemetry flows through dedicated ingestion services (sensara-adaptor, megazord-events), triggers fan-out to downstream automations, and status evaluations update shared databases
- **Shared contracts:** OpenAPI specs (tiny-specs) generate TypeScript types used by both frontend and backend, ensuring type consistency across the stack
- **Shared middleware:** Common HTTP clients, DTOs, and service scaffolding are centralized in tiny-backend-tools and tiny-internal-services to avoid duplication
- **Database-per-concern:** Separate MySQL databases for scheduling/automation data (typ-e) and dashboard/TaaS data (wonkers-db), with an anonymised analytics copy (atlas-intelligence-db)

## Architecture Overview

- **Telemetry ingestion:** External sensor data (Sensara, robot events) enters through adaptor services, gets normalized, and dispatches to trigger/status evaluation pipelines
- **Automation pipeline:** Triggers fan out to status checks, schedule management (eve), and script execution (micro-manager), with voice interaction support (wadsworth)
- **TaaS order flow:** External notifications (Ecare/ZSP via wonkers-ecd, Nedap ONS via wonkers-nedap) feed into order lifecycle management (wonkers-taas-orders)
- **Customer/admin surfaces:** REST (wonkers-api) and GraphQL (wonkers-graphql) gateways back the customer dashboard (ui.r2d2) and admin dashboard (wonkers-dash-admin)
- **Data anonymisation:** Atlas batch jobs copy typ-e data into an intelligence database with anonymisation for analytics

## Development Approach

- Backend repos follow `workspaces/tinybots/backend/<repo>/` convention; frontend repos follow `workspaces/tinybots/frontend/<repo>/`
- Resource documentation lives under `resources/workspaces/tinybots/<domain>/<repo>/`
- Use DevTools infrastructure at `workspaces/devtools/tinybots/local/` for Docker Compose, Just commands, and seed data
- Shared dependencies (tiny-backend-tools, tiny-internal-services) should be updated first when making cross-service changes
- Keep OpenAPI specs in tiny-specs as the single source of truth for API contracts

## Quick Reference

- **Run repo tests:** `just -f workspaces/devtools/tinybots/local/Justfile test-<repo>`
- **Start repo dependencies:** `just -f workspaces/devtools/tinybots/local/Justfile start-<repo>`
- **View service logs:** `just -f workspaces/devtools/tinybots/local/Justfile log-<repo>`
- **Frontend tests:** `cd workspaces/tinybots/frontend/<repo> && npm test`
- **DevTools details:** See `resources/workspaces/devtools/tinybots/OVERVIEW.md`

## Rules Reference

- **run-tests:** Load before running tests for any repository → `agent/rules/tinybots/run-tests.md`

## Skills Reference

- **database-access:** Load when working on schema changes, migrations, or DB queries → `agent/skills/tinybots/database-access/SKILL.md`
- **confluence-sync:** Load when syncing markdown docs between local and Confluence → `agent/skills/tinybots/confluence-sync/SKILL.md`
- **testing-guidelines:** Load when writing or fixing tests → `agent/skills/tinybots/testing-guidelines/SKILL.md`
