# 📋 [PROD-437: 2026-02-13] - Complete PR #65: Sensara Endpoints Review & Fix

## References

- **PR:** `#65` — `feature/PROD-437-sensara-endpoints` → `develop` (Author: Arno Nederlof)
- **Branch:** `feature/PROD-437-sensara-endpoints` in `projects/tinybots/backend/sensara-adaptor`
- **Previous Analysis:** `devdocs/projects/tinybots/backend/sensara-adaptor/260117-PROD-437-sensara-endpoints-review-and-update.md`
- **Remaining Gaps:** `devdocs/projects/tinybots/backend/sensara-adaptor/260118-PROD-437-walkthrough-remaining-gaps.md`
- **Repo Overview:** `devdocs/projects/tinybots/backend/sensara-adaptor/OVERVIEW.md`
- **Internal Services Repo:** `projects/tinybots/backend/tiny-internal-services` (managed by us — can modify EventService if needed)

---

## 🎯 Objective

Address all PR review comments, fix code quality issues, resolve build failures, migrate routes to spec paths, implement missing endpoints, and enforce authentication — bringing PR #65 to a merge-ready state.

### ⚠️ Key Considerations

1. **Build is clean** — verified `tsc --noEmit` and `yarn run build` pass (2026-02-13); previous 8 TS errors already resolved on branch
2. **6 unresolved PR review comments** from Kai (2026-02-03) — none have been addressed
3. **2 missing endpoints** from the spec (`GET` and `PATCH` by residentId)
4. **Route migration** — all paths migrate to `/v1/ext/sensara/*` (PR not yet merged, no backward compat needed)
5. **Authentication enforced** on all endpoints (confirmed: "ignore auth" no longer applies)
6. **Trigger endpoints** exposed externally at `/v1/ext/sensara/...` but internally call `tiny-internal-services` (EventService)
7. **Soft-delete gap** — `getResidentByResidentId` and `getResidentByRobotId` queries do NOT filter `is_active=1`, meaning soft-deleted residents can be resolved by read/trigger flows
8. **Error handling dependency** — `EventService.getTriggerSubscription` in `tiny-internal-services` wraps upstream failures into generic errors, losing HTTP status distinctions; controller error-handling fix (2.4) requires coordinated SDK change

### Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Path naming | Migrate to `/v1/ext/sensara/*` — PR not merged, no consumers on old path |
| Q2 | Trigger endpoints | Expose externally under `/v1/ext/sensara/...`; internally call `tiny-internal-services` |
| Q3 | Authentication | Enforce auth on ALL endpoints (no longer ignored) |
| Q4 | Soft/hard delete | Soft delete is the correct strategy; however `is_active=1` filtering is NOT yet applied to all read/resolve queries — must be enforced (see Phase 1) |
| Q5 | `x-relation-id` header | Keep as required for GET-all (organization scoping) |
| Q6 | DB-direct | Keep using internal services; handle errors properly (best-effort with proper error handling) |
| Q7 | Soft-deleted residents | Treat as "not found" for all read/resolve/trigger routes — enforce `is_active=1` on read queries only; upsert query (`GET_REGISTER_USER_BY_ROBOT_OR_RESIDENT`) stays unfiltered for reactivation |
| Q8 | Error semantics dependency | Update `tiny-internal-services` in this same delivery as a dependency pre-step (Step A of Phase 2.4) |

---

## 📊 Current State Analysis

### PR Comments Status (Bitbucket PR #65)

| # | File | Comment (Kai) | Response (Arno) | Status |
|---|------|---------------|-----------------|--------|
| 1 | `src/service/ResidentService.ts:75` | **N+1 query** — suggests batch lookup with `getRobotAndUserAccountDetailsBySerials` + Map instead of per-resident `getRobotAccountById` | — | ❌ NOT FIXED |
| 2 | `src/controller/ResidentController.ts:138` | **Wrong subscription logic** — "should be one subscription per event, rather than per robot" | — | ❌ NOT FIXED |
| 3 | `src/model/mapper/TriggerSubscriptionMapper.ts:1` | **Import path** — "should from `tiny-internal-services`" (currently imports from `tiny-internal-services/dist`) | — | ❌ NOT FIXED |
| 4 | `src/controller/ResidentController.ts:131` | **Error swallowing** — "Any upstream error is being defaulted to 'no subscription'?" | "should indeed depend on the error" | ❌ NOT FIXED |
| 5 | `src/controller/ResidentController.ts:195` | **Wrong status code** — "should 400" (currently returns 500) | — | ❌ NOT FIXED |
| 6 | (general) | **`console.log` in production** (`ResidentService.ts:60`) | — | ❌ NOT FIXED |

### Build Status

**Build is CLEAN** — verified 2026-02-13 on branch `feature/PROD-437-sensara-endpoints`:
- `yarn run build` — passes (exit 0)
- `npx tsc --noEmit` — passes (0 errors)

Previous 8 TS errors (documented in earlier analysis) have already been resolved on the branch. Phase 1 (Fix Build) is no longer needed.

### Implemented vs Required Endpoints

| Spec Endpoint | Method | Current Path | Status |
|---------------|--------|--------------|--------|
| `/v1/ext/sensara/residents` | GET | `/v1/sensara/residents` | ⚠️ Path needs migration |
| `/v1/ext/sensara/residents` | PUT | `/v1/sensara/residents` | ⚠️ Path needs migration |
| `/v1/ext/sensara/residents/{residentId}` | DELETE | `/v1/sensara/residents/:residentId` | ⚠️ Path needs migration |
| `/v1/ext/sensara/residents/{residentId}` | GET | — | ❌ NOT IMPLEMENTED |
| `/v1/ext/sensara/residents/{residentId}` | PATCH | — | ❌ NOT IMPLEMENTED |
| `/v1/ext/sensara/residents/{residentId}/events/subscriptions/triggers` | POST | `/internal/v1/events/residents/:residentId/subscriptions/triggers` | ⚠️ Path needs migration |
| `/v1/ext/sensara/residents/{residentId}/events/subscriptions/triggers` | GET | `/internal/v1/events/residents/:residentId/subscriptions/triggers` | ⚠️ Path needs migration |
| `/v1/ext/sensara/residents/{residentId}/events/subscriptions/triggers/{subscriptionId}` | DELETE | `/internal/v1/events/residents/:residentId/subscriptions/triggers/:subscriptionId` | ⚠️ Path needs migration |

---

## 🔄 Implementation Plan

### Phase 1: Enforce Soft-Delete Semantics (Data Integrity — blocks Phase 4)

> Soft-deleted residents (`is_active=0`) must not be resolvable by any read or trigger flow.

- [ ] **1.1** Add `AND is_active=1` filter to read/resolve queries (NOT upsert queries)
  - **File:** `src/repository/ResidentRepository.ts`
  - **Queries to filter (add `AND is_active=1`):**
    - `GET_REGISTER_USER_BY_RESIDENT` (line 41) — used by `getResidentByResidentId`
    - `GET_REGISTER_USER_BY_ROBOT` (line 45) — used by `getResidentByRobotId`
    - `GET_RESIDENTS_WITH_ROBOTS_AND_LOCATIONS` (line 69) — used by `getResidentsWithRobots` (list endpoint)
  - **Query to leave UNFILTERED:**
    - `GET_REGISTER_USER_BY_ROBOT_OR_RESIDENT` (line 49) — used by `registerResident` upsert logic (must find soft-deleted rows to reactivate, not create duplicates)
  - **Outcome:** All read/resolve API paths return only active residents; upsert/reactivation path preserved
- [ ] **1.2** Add soft-delete test coverage
  - **File:** `test/controller/ResidentControllerIT.ts`
  - **Tests:**
    - Deleted resident excluded from `GET /v1/ext/sensara/residents` list
    - Trigger flows on deleted resident return 404
    - **Deferred to Phase 4.1:** Deleted resident returns 404 on `GET /v1/ext/sensara/residents/:residentId` (endpoint not yet implemented in Phase 1)
  - **Outcome:** Soft-delete semantics verified for existing resident read/trigger paths; GET-by-id test added alongside endpoint implementation

### Phase 2: PR Review Comments (Code Quality Fixes)

- [ ] **2.1** Fix N+1 query in `ResidentService.getResidentsWithRobots`
  - **File:** `src/service/ResidentService.ts:64-71`
  - **Change:** Replace per-resident `getRobotAccountById` loop with batch `getRobotAndUserAccountDetailsBySerials` + Map lookup
  - **Before:**
    ```typescript
    const robotAccounts = await Promise.all(
      residentRobots.map(r => this._robotAccountService.getRobotAccountById(r.robotId))
    )
    residentRobots = residentRobots.map((resident, idx) => {
      const account = robotAccounts[idx]
      if (account) resident.robotSerial = account.username
      return resident
    })
    ```
  - **After:**
    ```typescript
    const robotIdToSerial = new Map(robotAccountDetails.map(d => [d.robotId, d.serial]))
    residentRobots = residentRobots.map(r => ({
      ...r,
      robotSerial: robotIdToSerial.get(r.robotId) ?? null
    }))
    ```
  - **Note:** `robotAccountDetails` already fetched at line 51 — reuse it, remove the second service call entirely
  - **Outcome:** Single batch call instead of N calls; eliminates N+1 query
  - **Tests:** Update `test/service/ResidentServiceTest.ts` — remove `getRobotAccountById` mocks

- [ ] **2.2** Fix subscription logic — per-event instead of per-robot
  - **File:** `src/controller/ResidentController.ts:110-151`
  - **Change:** `createTriggerSubscription` should check for existing subscription by event name (`req.body.eventName`), not by robot
  - **Outcome:** Multiple subscriptions per robot allowed (one per event type)
  - **Tests:** Update `test/controller/ResidentControllerIT.ts` POST trigger tests

- [ ] **2.3** Fix import path in TriggerSubscriptionMapper
  - **File:** `src/model/mapper/TriggerSubscriptionMapper.ts:1`
  - **Change:** `import { SubscriptionDomain } from 'tiny-internal-services/dist'` → `import { SubscriptionDomain } from 'tiny-internal-services'`
  - **Outcome:** Clean import from package root

- [ ] **2.4** Fix error handling in `getTriggerSubscription` (coordinated with `tiny-internal-services`)
  - **Step A — Dependency change in `tiny-internal-services`:**
    - **File:** `projects/tinybots/backend/tiny-internal-services` — `EventService.getTriggerSubscription`
    - **Change:** Preserve upstream HTTP status in thrown errors (e.g., typed `NotFoundError` vs `InternalServerError`) instead of wrapping all failures into a generic error
    - **Outcome:** Callers can distinguish "not found" from "server error"
  - **Step B — Controller change in `sensara-adaptor`:**
    - **File:** `src/controller/ResidentController.ts:125-132` and `:170-177`
    - **Change:** Check error type from EventService — only map `NotFoundError` to 404; re-throw all other errors
    - **Outcome:** Upstream 500s propagate correctly; only actual 404s become `NotFoundError`
  - **Note:** Step A must be completed and published before Step B can be implemented

- [ ] **2.5** Fix status code 500 → 400 for invalid subscriptionId
  - **File:** `src/controller/ResidentController.ts:195`
  - **Change:** `res.status(500)` → `res.status(400)`
  - **Outcome:** Correct HTTP semantics for client validation error

- [ ] **2.6** Replace `console.log` with Logger
  - **File:** `src/service/ResidentService.ts:60`
  - **Change:** Add `ctx: IRequestContext` parameter to `getResidentsWithRobots`, replace:
    ```typescript
    console.log('No residents found for robotIds:', robotIds)
    ```
    with:
    ```typescript
    Logger.loggerFromCtx(ctx).info('No residents found for robotIds', { robotIds })
    ```
  - **Outcome:** Structured logging with request context

- [ ] **2.7** Add missing validation decorator
  - **File:** `src/model/ServiceConfig.ts:11`
  - **Change:** Add `@IsString()` `@MinLength(1)` above `robotAccountServiceAddress: string`
  - **Outcome:** Config validation consistent across all service addresses

### Phase 3: Route Migration & Auth Enforcement

> PR not merged, no consumers on old paths → migrate directly, no aliases needed.

- [ ] **3.1** Migrate all resident routes to `/v1/ext/sensara/*`
  - **File:** `src/App.ts`
  - **Changes:**
    | Old Path | New Path |
    |----------|----------|
    | `PUT /v1/sensara/residents` | `PUT /v1/ext/sensara/residents` |
    | `DELETE /v1/sensara/residents/:residentId` | `DELETE /v1/ext/sensara/residents/:residentId` |
    | `GET /v1/sensara/residents` | `GET /v1/ext/sensara/residents` |
  - **Outcome:** All resident routes under `/v1/ext/sensara/*`

- [ ] **3.2** Migrate trigger routes from internal to external path
  - **File:** `src/App.ts`
  - **Changes:**
    | Old Path | New Path |
    |----------|----------|
    | `POST /internal/v1/events/residents/:residentId/subscriptions/triggers` | `POST /v1/ext/sensara/residents/:residentId/events/subscriptions/triggers` |
    | `GET /internal/v1/events/residents/:residentId/subscriptions/triggers` | `GET /v1/ext/sensara/residents/:residentId/events/subscriptions/triggers` |
    | `DELETE /internal/v1/events/residents/:residentId/subscriptions/triggers/:subscriptionId` | `DELETE /v1/ext/sensara/residents/:residentId/events/subscriptions/triggers/:subscriptionId` |
  - **Outcome:** All trigger routes under `/v1/ext/sensara/*`, exposed externally

- [ ] **3.3** Add authentication to all endpoints
  - **Currently unauthenticated:**
    - `GET /v1/ext/sensara/residents`
    - `POST /v1/ext/sensara/residents/:residentId/events/subscriptions/triggers`
    - `GET /v1/ext/sensara/residents/:residentId/events/subscriptions/triggers`
    - `DELETE /v1/ext/sensara/residents/:residentId/events/subscriptions/triggers/:subscriptionId`
  - **Already authenticated (keep):**
    - `PUT /v1/ext/sensara/residents` — `SENSARA_RESIDENT_WRITE_ALL`
    - `DELETE /v1/ext/sensara/residents/:residentId` — `SENSARA_RESIDENT_WRITE_ALL`
  - **Change:** Add `KongHeaderMiddleware` + `PermissionValidator` to all routes
  - **Permission:** Reuse `SENSARA_RESIDENT_WRITE_ALL` for all endpoints (including GET) temporarily
  - **Tests:** Add 403 tests for unauthenticated requests on all endpoints

- [ ] **3.4** Update all test paths to `/v1/ext/sensara/*`
  - **File:** `test/controller/ResidentControllerIT.ts`
  - **Change:** Replace all `/v1/sensara/` and `/internal/v1/events/` with `/v1/ext/sensara/`
  - **Outcome:** Tests match new route paths

### Phase 4: Missing Endpoints

- [ ] **4.1** Implement `GET /v1/ext/sensara/residents/{residentId}`
  - **Files:** `ResidentController.ts`, `ResidentService.ts`, `App.ts`
  - **Auth:** `SENSARA_RESIDENT_WRITE_ALL`
  - **Flow:**
    ```
    residentId (path param)
      → ResidentRepository.getResidentByResidentId(residentId) (is_active=1 enforced)
      → RobotAccountService.getRobotAccountById(robotId) → robotSerial
      → ResidentRepository.getHearableLocations(robotId)
      → Response: { id, residentId, robotId, hearableLocations, robotSerial }
    ```
  - **Note:** `robotSerial` is fetched from `RobotAccountService` (same service used by list endpoint), not from repository
  - **Tests:** IT for: 200 success, 404 not found, 404 deleted resident (soft-delete from Phase 1.2), 403 no permission

- [ ] **4.2** Implement `PATCH /v1/ext/sensara/residents/{residentId}`
  - **Files:** `ResidentController.ts`, `ResidentService.ts`, `ResidentRepository.ts`, `App.ts`
  - **New DTO:** `src/model/dto/ResidentPatchDto.ts` with `hearableLocations: string[]`
  - **Auth:** `SENSARA_RESIDENT_WRITE_ALL`
  - **Flow:**
    ```
    residentId (path param) + body: { hearableLocations: string[] }
      → ResidentRepository.getResidentByResidentId(residentId)
      → Delete existing hearable locations for robotId
      → Insert new hearable locations
      → Response: { id, residentId, robotId, hearableLocations }
    ```
  - **Tests:** IT for: 200 success, 404 not found, 400 validation error, 403 no permission

### Phase 5: Testing & Verification

- [ ] **5.1** Run full test suite: `just -f devtools/tinybots/local/Justfile test-sensara-adaptor`
  - **Outcome:** All tests pass
- [ ] **5.2** Verify build: `yarn run build`
  - **Outcome:** 0 errors
- [ ] **5.3** Verify lint/typecheck passes
- [ ] **5.4** Review all changes end-to-end before marking PR ready

---

## 📊 File Structure After Updates

```
src/
├── App.ts                                    # 🔄 Migrate routes + add auth
├── constants/Container.ts                    # ✅ Already updated
├── controller/
│   ├── LocationController.ts                 # ✅ Build already clean
│   └── ResidentController.ts                 # 🔄 Fix review issues + add GET/PATCH by id
├── model/
│   ├── ResidentRobot.ts                      # ✅ Already has ResidentRobotWithSerial
│   ├── ServiceConfig.ts                      # 🔄 Add @IsString() to robotAccountServiceAddress
│   ├── dto/
│   │   ├── TriggerSubscriptionDto.ts         # ✅ Already implemented
│   │   ├── ResidentPatchDto.ts               # 🚧 NEW — for PATCH endpoint
│   │   └── index.ts                          # 🔄 Export new DTO
│   └── mapper/
│       ├── ResidentRobotMapper.ts            # ✅ Already implemented
│       └── TriggerSubscriptionMapper.ts      # 🔄 Fix import path
├── repository/ResidentRepository.ts          # 🔄 Add is_active=1 to lookups + update hearable locations
├── service/
│   ├── LocationService.ts                    # ✅ Build already clean
│   └── ResidentService.ts                    # 🔄 Fix N+1 + console.log + add ctx

projects/tinybots/backend/tiny-internal-services/
└── (EventService)                            # 🔄 Preserve upstream error types for getTriggerSubscription

test/
├── controller/ResidentControllerIT.ts        # 🔄 Migrate paths + auth tests + soft-delete tests + new endpoint tests
├── model/Mapper/
│   ├── ResidentRobotMapperTest.ts            # ✅ Already implemented
│   └── TriggerSubscriptionMapperTest.ts      # ✅ Already implemented
└── service/ResidentServiceTest.ts            # 🔄 Update mocks for batch query
```

---

## 📊 Summary of Results

> Not executed — will be updated after implementation is complete

### ✅ Completed Achievements

_Pending implementation_

---

## 🚧 Outstanding Issues & Follow-up

### ✅ Resolved During Planning

- [x] **Read permission** — reuse `SENSARA_RESIDENT_WRITE_ALL` for all endpoints (including GET) temporarily
- [x] **`tiny-internal-services` changes** — repo is at `projects/tinybots/backend/tiny-internal-services`, managed by us. If EventService contract needs changes for per-event subscription logic (Phase 2.2), modify directly

### 📝 Priority Order

| Priority | Phase | Description | Can Start Now? |
|----------|-------|-------------|----------------|
| 🔴 P0 | Phase 1 | Enforce Soft-Delete Semantics | ✅ Yes |
| 🔴 P0 | Phase 2 | PR Review Fixes | ✅ Yes (parallel with Phase 1) |
| 🟡 P1 | Phase 3 | Route Migration & Auth | ✅ Yes (parallel with Phase 1-2) |
| 🟡 P1 | Phase 4 | Missing Endpoints | ✅ After Phase 1 (needs active-only queries) |
| 🟢 P2 | Phase 5 | Testing & Verification | After all above |

### 📝 Notes

- All stakeholder decisions resolved — no blockers remaining
- Build is already clean — Phase 1 (old: Fix Build) removed; replaced with Soft-Delete Semantics enforcement
- Phase 2.4 (error handling) now includes coordinated `tiny-internal-services` change as a dependency step
- Phase 3 (route migration) and Phase 4 (new endpoints) are unblocked since all paths confirmed as `/v1/ext/sensara/*`
- The PROD-983 merge already resolved `describe.only`, updated yarn, and fixed build errors
