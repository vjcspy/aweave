# [260216-m-o-triggers-trigger-settings-api-spec] - [Create m-o-triggers Trigger Settings API Spec in tiny-specs]

## References

- `devdocs/projects/tinybots/OVERVIEW.md`
- `devdocs/projects/tinybots/backend/tiny-specs/OVERVIEW.md`
- `devdocs/agent/commands/tinybots/update-tiny-specs.md`
- `devdocs/projects/tinybots/backend/m-o-triggers/251103-trigger-configuration.md`
- `devdocs/projects/tinybots/backend/m-o-triggers/251107-update-setting-column-implement-plan.md`
- `devdocs/projects/tinybots/backend/m-o-triggers/251129-Get-Active-Trigger-Settings.md`
- `projects/tinybots/backend/m-o-triggers/src/cmd/app/main.ts`
- `projects/tinybots/backend/m-o-triggers/src/controllers/EventTriggerSettingsController.ts`
- `projects/tinybots/backend/m-o-triggers/src/models/dtos/UpsertTriggerSettingDto.ts`
- `projects/tinybots/backend/m-o-triggers/src/models/domains/EventTriggerDomain.ts`
- `projects/tinybots/backend/m-o-triggers/test/controllers/EventTriggerSettingControllerIT.ts`
- `projects/tinybots/backend/tiny-specs/src/main.ts`
- `projects/tinybots/backend/tiny-specs/specs/local/micro-manager-main.yaml`

## User Requirements

```text
I'm not prety sure aboubt current implementation, but last time we have implemented follow on those plans:
`devdocs/projects/tinybots/backend/m-o-triggers/251103-trigger-configuration.md`
`devdocs/projects/tinybots/backend/m-o-triggers/251107-update-setting-column-implement-plan.md`
`devdocs/projects/tinybots/backend/m-o-triggers/251129-Get-Active-Trigger-Settings.md`
Now we need to create api spec in `projects/tinybots/backend/tiny-specs`
Give me a plan to do it
```

## Objective

Create and publish OpenAPI contract files in `projects/tinybots/backend/tiny-specs` for the implemented `m-o-triggers` trigger-setting endpoints so downstream consumers can generate types and validators from a stable spec.

### Key Considerations

- The implemented endpoints are `PUT /v1/triggers/settings` and `GET /v1/triggers/settings` with admin permission flow; spec must match current behavior exactly before adding any enhancements.
- Request payload must model `allowedDaysOfWeek` as optional enum array (`mon`..`sun`) and time fields as `HH:mm` strings; response payload must include formatted times and boolean `isDefault`.
- tiny-specs currently has no `m-o-triggers` service entry; implementation must add full service wiring (components, paths, main file, generator registration).
- A target bundle decision is required (`dist/dashboard` vs `dist/webapp`) based on actual consumer repository usage.
- Error response documentation should reflect real status codes from integration tests (400, 403, 404 where applicable) and avoid inventing undocumented payload shapes.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Analyze detailed requirements
  - **Outcome**: Confirmed minimum contract scope is:
    - `PUT /v1/triggers/settings` request + success response
    - `GET /v1/triggers/settings` array success response
    - Shared schema for `EventTriggerSetting`
    - Optional `allowedDaysOfWeek` enum array
- [x] Define scope and edge cases
  - **Outcome**:
    - Edge case: `allowedDaysOfWeek` omitted or empty means no day constraint
    - Edge case: day values restricted to `mon|tue|wed|thu|fri|sat|sun`
    - Edge case: time fields serialized as `HH:mm` in response
    - Edge case: `GET` can return an empty array
    - Edge case: `robotId` nullable for default settings
- [x] Evaluate existing test structures and define test cases
  - **Outcome**:
    - Contract reference source: `projects/tinybots/backend/m-o-triggers/test/controllers/EventTriggerSettingControllerIT.ts`
    - Validation scenarios to map in spec:
      - PUT success with and without `allowedDaysOfWeek`
      - PUT validation failure (400)
      - GET success with populated and empty arrays
      - GET authorization/header failures (403/400)

### Phase 2: Implementation Structure

```
projects/tinybots/backend/tiny-specs/
├── specs/local/m-o-triggers-main.yaml                               # 🚧 TODO - New OpenAPI entry for m-o-triggers
├── specs/local/components/m-o-triggers/v1/schemas.yaml              # 🚧 TODO - Request/response schemas and reusable params/bodies
├── specs/local/paths/m-o-triggers/v1/paths.yaml                     # 🚧 TODO - Path operations for PUT/GET /v1/triggers/settings
└── src/main.ts                                                      # 🔄 IN PROGRESS - Register m-o-triggers in selected generation target

projects/tinybots/backend/m-o-triggers/
└── test/controllers/EventTriggerSettingControllerIT.ts              # ✅ IMPLEMENTED - Source of truth for actual API behavior
```

### Phase 3: Detailed Implementation Steps

- [x] Step 1: Lock contract baseline from implementation
  - Extract canonical request/response field lists and status codes from controller + DTO + integration tests.
  - Freeze v1 contract content to current behavior (no additional fields/filters/pagination).

- [x] Step 2: Add m-o-triggers OpenAPI component schemas
  - Create `projects/tinybots/backend/tiny-specs/specs/local/components/m-o-triggers/v1/schemas.yaml`.
  - Define reusable schemas:
    - `DayOfWeek`
    - `UpsertTriggerSettingRequest`
    - `EventTriggerSetting`
    - `EventTriggerSettingList` (array wrapper or direct array usage)
  - Define requestBody for PUT and reusable error response refs where applicable.

- [x] Step 3: Add m-o-triggers OpenAPI paths
  - Create `projects/tinybots/backend/tiny-specs/specs/local/paths/m-o-triggers/v1/paths.yaml`.
  - Define both operations on `/v1/triggers/settings`:
    - `put` with requestBody and `201` response
    - `get` with `200` array response
  - Add security section aligned with admin-authenticated endpoints in tiny-specs conventions.

- [x] Step 4: Add service main file and refs
  - Create `projects/tinybots/backend/tiny-specs/specs/local/m-o-triggers-main.yaml`.
  - Wire path refs to `paths/m-o-triggers/v1/paths.yaml` and security schemes from common components.

- [x] Step 5: Register generator target
  - Update `projects/tinybots/backend/tiny-specs/src/main.ts` to include `m-o-triggers-main.yaml` in the correct output target.
  - Decision gate:
    - If only admin/dashboard clients consume this API, add to `dashboardSchemas`.
    - If robot/webapp clients consume this API, add to `webappSchemas`.

- [x] Step 6: Build and validate tiny-specs
  - Run `yarn run all` in `projects/tinybots/backend/tiny-specs`.
  - Verify generation output includes m-o-triggers artifacts under selected dist target.
  - Fix any parser/merge/codegen issues until clean build.

- [ ] Step 7: Consumer compatibility check
  - In the consuming repo, verify generated type names are importable and match expected fields.
  - If needed, adjust schema naming or operationId for stable generated API names before merging.

- [ ] Step 8: Delivery and rollout
  - Commit tiny-specs changes on feature branch.
  - Update consuming repo dependency to the tiny-specs feature branch for integration testing.
  - After tiny-specs merge, switch dependency back to `#master` in consumer.

## Summary of Results

Implemented m-o-triggers trigger settings API spec in tiny-specs and generated dashboard artifacts successfully.

- Added `m-o-triggers` service OpenAPI files (`main`, `components`, `paths`) covering:
  - `PUT /v1/triggers/settings` (`201`, `400`, `403`, `404`)
  - `GET /v1/triggers/settings` (`200`, `400`, `403`)
- Modeled `allowedDaysOfWeek` as optional enum array and time fields as `HH:mm` strings.
- Modeled response with nullable `robotId`, `isDefault`, and optional day constraints.
- Registered `m-o-triggers` in `dashboardSchemas` in `src/main.ts`.
- Ran `yarn run all` in `projects/tinybots/backend/tiny-specs` with successful compile and generated output updates.

## Outstanding Issues & Follow-up

### Issues/Clarifications

- [ ] Confirm generation target for `m-o-triggers` (`dashboardSchemas` vs `webappSchemas`) based on real consumer repository.
- [x] Confirm whether `403` and `404` responses should include standardized error bodies in spec, or remain description-only to match current implementation behavior.
- [x] Confirm whether `allowedDaysOfWeek: []` should be accepted as equivalent to omitted (current behavior effectively treats no values as unconstrained after serialization).

## Implementation Notes / As Implemented

- Contract baseline was taken from:
  - `projects/tinybots/backend/m-o-triggers/src/cmd/app/main.ts`
  - `projects/tinybots/backend/m-o-triggers/src/models/dtos/UpsertTriggerSettingDto.ts`
  - `projects/tinybots/backend/m-o-triggers/src/models/domains/EventTriggerDomain.ts`
  - `projects/tinybots/backend/m-o-triggers/test/controllers/EventTriggerSettingControllerIT.ts`
- New files created:
  - `projects/tinybots/backend/tiny-specs/specs/local/m-o-triggers-main.yaml`
  - `projects/tinybots/backend/tiny-specs/specs/local/components/m-o-triggers/v1/schemas.yaml`
  - `projects/tinybots/backend/tiny-specs/specs/local/paths/m-o-triggers/v1/paths.yaml`
- Generator registration added:
  - `projects/tinybots/backend/tiny-specs/src/main.ts` (`dashboardSchemas`)
- Error-body decision as implemented:
  - `400`: documented with `common/Error` schema (`message`), aligned with observed integration-test responses.
  - `403`: documented with `common/Error` schema.
  - `404`: documented as description-only (no fixed payload shape), to avoid over-specifying undocumented fields.
- `allowedDaysOfWeek` semantics as implemented:
  - Request field is optional; omitted or empty array is documented as unconstrained schedule days.
- Verification:
  - `yarn run all` completed successfully in `projects/tinybots/backend/tiny-specs`, and generated dashboard typings/validators include `DayOfWeek`, `EventTriggerSetting`, and `UpsertTriggerSettingRequest`.
