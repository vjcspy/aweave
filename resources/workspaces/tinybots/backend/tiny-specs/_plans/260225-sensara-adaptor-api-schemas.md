---
name: "260225 - Sensara Adaptor API Schemas"
description: "Detailed plan for implementing Sensara adaptor API schemas and parameters in tiny-specs, covering both internal admin and external relation-based endpoints."
created: 2026-02-25
tags: ["plans","tiny-specs"]
status: done
---

# 260225 - Sensara Adaptor API Schemas

## References

- `resources/workspaces/tinybots/backend/sensara-adaptor/_documentations/sensara-resident-and-trigger-apis.md`
- `workspaces/tinybots/backend/tiny-specs/specs/local/` (existing spec patterns)
- `workspaces/tinybots/backend/tiny-specs/src/main.ts` (spec registration)

## Objective

Add OpenAPI 3.0 specs for the **sensara-adaptor** service to the `tiny-specs` package. The service exposes 8 endpoints split into two groups:

| Group | Base Path | Auth | Endpoints |
|-------|-----------|------|-----------|
| Internal | `/v1/sensara` | Kong admin headers | PUT residents, DELETE residents/{id} |
| External | `/ext/v1/sensara` | `x-relation-id` header | GET residents, GET residents/{id}, PATCH residents/{id}, POST/GET/DELETE triggers |

### Key Considerations

- Follow the established pattern: `*-main.yaml` → `paths/<service>/` → `components/<service>/`
- Register the new spec in `src/main.ts` under the `webappSchemas` group (as it serves external clients).
- Define an Error Response Matrix to handle mixed error shapes in the current implementation correctly.
- Extract common parameters (`x-relation-id`, `residentId`, `subscriptionId`) into reusable `components.parameters` to ensure consistency.
- Internal endpoints use `AdminAuthToken` security scheme; external endpoints use a custom `x-relation-id` header parameter (no bearer auth).
- Run `yarn generate` to verify spec compiles successfully

## Implementation Plan

### Phase 1: Schema Components

- [ ] Create `specs/local/components/sensara-adaptor/v1/schemas.yaml`
  - Define schemas:
    - `SensaraResident` — response model (id, residentId, robotId, hearableLocations)
    - `SensaraResidentWithSerial` — extends with `robotSerial` (external GET responses)
    - `UpsertResidentRequest` — PUT body (residentId, robotId, hearableLocations)
    - `PatchResidentRequest` — PATCH body (hearableLocations)
    - `TriggerSubscription` — trigger response model (id, robotId, eventName, isActive, subscriptionType, createdAt, updatedAt)
    - `CreateTriggerRequest` — POST body (eventName)
  - Define `requestBodies` and `responses` sections

- [ ] Create `specs/local/components/sensara-adaptor/v1/parameters.yaml`
  - Define reusable parameters to avoid duplication across 6 external endpoints:
    - `RelationIdHeader`: `in: header`, `name: x-relation-id`, schema integer
    - `ResidentIdPath`: `in: path`, `name: residentId`, schema string
    - `SubscriptionIdPath`: `in: path`, `name: subscriptionId`, schema string

- [ ] Define **Error Response Matrix** in path responses:
  - `400 Bad Request` (from relationIdMiddleware & invalid subscriptionId): standard `Error` schema (for `{ message: string }`)
  - `400 Bad Request` (from DTO/body validation in PUT/PATCH/POST): `ValidationError` schema
  - `404 Not Found` (from missing resident/subscription): `NotFoundError` schema
  - `409 Conflict` (from duplicate trigger subscription): standard `Error` schema (for `{ message: '...' }`)

### Phase 2: Path Definitions

- [ ] Create `specs/local/paths/sensara-adaptor/internal/v1/paths.yaml`
  - `PUT /v1/sensara/residents` — admin auth, request body → 200 SensaraResident
  - `DELETE /v1/sensara/residents/{residentId}` — admin auth → 204

- [ ] Create `specs/local/paths/sensara-adaptor/ext/v1/paths.yaml`
  - `GET /ext/v1/sensara/residents` — x-relation-id header → 200 array of SensaraResidentWithSerial
  - `GET /ext/v1/sensara/residents/{residentId}` — x-relation-id → 200 SensaraResidentWithSerial
  - `PATCH /ext/v1/sensara/residents/{residentId}` — x-relation-id + body → 200 SensaraResident
  - `POST /ext/v1/sensara/residents/{residentId}/events/subscriptions/triggers` — x-relation-id + body → 201 TriggerSubscription
  - `GET /ext/v1/sensara/residents/{residentId}/events/subscriptions/triggers` — x-relation-id → 200 array TriggerSubscription
  - `DELETE /ext/v1/sensara/residents/{residentId}/events/subscriptions/triggers/{subscriptionId}` — x-relation-id → 204

### Phase 3: Main Spec & Registration

- [ ] Create `specs/local/sensara-adaptor-main.yaml`
  - OpenAPI 3.0.1 document referencing all 8 paths and security schemes

- [ ] Register in `src/main.ts`
  - Add `sensara-adaptor` entry to the `webappSchemas` array. This is the definitive consumer since the API is primarily for external integration. No new export groups are needed.

### Phase 4: Implementation Structure

```
specs/local/
├── sensara-adaptor-main.yaml                           # 🚧 NEW
├── components/
│   └── sensara-adaptor/
│       └── v1/
│           ├── schemas.yaml                            # 🚧 NEW
│           └── parameters.yaml                         # 🚧 NEW
├── paths/
│   └── sensara-adaptor/
│       ├── internal/
│       │   └── v1/
│       │       └── paths.yaml                          # 🚧 NEW
│       └── ext/
│           └── v1/
│               └── paths.yaml                          # 🚧 NEW
src/
└── main.ts                                             # 🔄 MODIFY - add registration
```

## Verification Plan

### Automated Tests

```bash
# From workspaces/tinybots/backend/tiny-specs/
yarn generate
```

This will parse, validate, and compile all specs including the new sensara-adaptor spec. If any schema references are broken or YAML is invalid, this command will fail with a descriptive error.

## Summary of Results

*To be updated after implementation.*
