# 📋 [PROD-437: 2026-02-25] - External Endpoint Restructure

## References

- **PR:** `#65` — `feature/PROD-437-sensara-endpoints` → `develop`
- **Previous Plan:** `resources/workspaces/tinybots/backend/sensara-adaptor/_plans/260213-PROD-437-PR65-completion-plan.md`
- **Branch:** `feature/PROD-437-sensara-endpoints` in `workspaces/tinybots/backend/sensara-adaptor`

---

## 🎯 Objective

Restructure the Sensara API surface based on new stakeholder requirements:

1. **Split endpoints** into internal (Rosa admin) and external (Sensara) groups
2. **Change external path prefix** from `/v1/ext/` → `/ext/v1/`
3. **Remove auth middleware** from external endpoints (confirmed with Vy: no validation needed)
4. **Revert PUT/DELETE** to internal (non-ext) paths — these are admin-only for Rosa
5. **Add `relationIdMiddleware`** to validate `x-relation-id` header on all external endpoints

### Stakeholder Design Decision: `x-relation-id` and Org Scoping

> [!IMPORTANT]
> Stakeholder confirmed: Sensara authenticates via an **org token**. The gateway injects `x-relation-id` into the request header. **No further server-side validation is needed per stakeholder** — the `x-relation-id` is trusted because it comes from the gateway, not directly from the client.
>
> This means the middleware **only validates the header format** (present + numeric). It does NOT cross-check whether a given `residentId` actually belongs to the organization identified by `relationId`. The gateway and org token mechanism are the authorization layer.

---

## 📊 Final Endpoint State (all implemented on branch)

| Endpoint | Method | Path | Middleware | Group |
|----------|--------|------|------------|-------|
| Register resident | `PUT` | `/v1/sensara/residents` | Kong + Admin + Permission + bodyValidator | 🔒 Internal (Rosa) |
| Delete resident | `DELETE` | `/v1/sensara/residents/:residentId` | Kong + Admin + Permission + pathValidator | 🔒 Internal (Rosa) |
| List residents | `GET` | `/ext/v1/sensara/residents` | `relationIdMiddleware` | 🌐 External (Sensara) |
| Get resident | `GET` | `/ext/v1/sensara/residents/:residentId` | `relationIdMiddleware` + pathValidator | 🌐 External (Sensara) |
| Patch resident | `PATCH` | `/ext/v1/sensara/residents/:residentId` | `relationIdMiddleware` + pathValidator + bodyValidator | 🌐 External (Sensara) |
| Create trigger | `POST` | `/ext/v1/sensara/residents/:residentId/events/subscriptions/triggers` | `relationIdMiddleware` + pathValidator + bodyValidator | 🌐 External (Sensara) |
| Get triggers | `GET` | `/ext/v1/sensara/residents/:residentId/events/subscriptions/triggers` | `relationIdMiddleware` + pathValidator | 🌐 External (Sensara) |
| Delete trigger | `DELETE` | `/ext/v1/sensara/residents/:residentId/events/subscriptions/triggers/:subscriptionId` | `relationIdMiddleware` + pathValidator | 🌐 External (Sensara) |

---

## 🔄 Implementation (completed)

### Phase 1: `relationIdMiddleware` — Header Validation for External Endpoints ✅

#### [NEW] [relationIdMiddleware.ts](file:///Users/kai/work/aweave/workspaces/tinybots/backend/sensara-adaptor/src/middleware/relationIdMiddleware.ts)

Express middleware that:

1. Reads `x-relation-id` from request header
2. Validates it is present and a positive integer
3. Returns `400` if missing or invalid
4. Stores parsed `relationId` on the request object for downstream use

```typescript
export const relationIdMiddleware = (req, res, next) => {
  const header = req.get('x-relation-id')
  if (!header) return res.status(400).json({ message: 'x-relation-id header is required' })
  const relationId = Number(header)
  if (isNaN(relationId) || relationId <= 0) return res.status(400).json({ message: 'Invalid relationId provided' })
  ;(req as any).relationId = relationId
  next()
}
```

> [!NOTE]
> The middleware does **not** enforce org scoping (i.e., it does not verify that `residentId` belongs to the org identified by `relationId`). This is by design — stakeholder confirmed that the gateway/org-token mechanism is the authorization layer. The middleware only validates header format. See the [Stakeholder Design Decision](#stakeholder-design-decision-x-relation-id-and-org-scoping) section.

#### [MODIFY] [App.ts](file:///Users/kai/work/aweave/workspaces/tinybots/backend/sensara-adaptor/src/App.ts)

Add `relationIdMiddleware` to **all 6 external endpoints**:

```diff
 this.app.get(
   '/ext/v1/sensara/residents',
+  relationIdMiddleware,
   asyncHandler(residentController.getResidentsWithRobotsByOrganization)
 )

 this.app.get(
   '/ext/v1/sensara/residents/:residentId',
+  relationIdMiddleware,
   ValidationMiddleware.pathValidator(ResidentIdPathDto),
   asyncHandler(residentController.getResidentByResidentId)
 )

 this.app.patch(
   '/ext/v1/sensara/residents/:residentId',
+  relationIdMiddleware,
   ValidationMiddleware.pathValidator(ResidentIdPathDto),
   ValidationMiddleware.bodyValidator(DTOs.ResidentPatchDto),
   asyncHandler(residentController.patchResident)
 )

 this.app.post(
   '/ext/v1/sensara/residents/:residentId/events/subscriptions/triggers',
+  relationIdMiddleware,
   ValidationMiddleware.pathValidator(ResidentIdPathDto),
   ValidationMiddleware.bodyValidator(DTOs.TriggerSubscriptionDto),
   asyncHandler(residentController.createTriggerSubscription)
 )

 this.app.get(
   '/ext/v1/sensara/residents/:residentId/events/subscriptions/triggers',
+  relationIdMiddleware,
   ValidationMiddleware.pathValidator(ResidentIdPathDto),
   asyncHandler(residentController.getTriggerSubscription)
 )

 this.app.delete(
   '/ext/v1/sensara/residents/:residentId/events/subscriptions/triggers/:subscriptionId',
+  relationIdMiddleware,
   ValidationMiddleware.pathValidator(DTOs.ResidentTriggerSubscriptionPathDto),
   asyncHandler(residentController.deleteTriggerSubscription)
 )
```

#### [MODIFY] [ResidentController.ts](file:///Users/kai/work/aweave/workspaces/tinybots/backend/sensara-adaptor/src/controller/ResidentController.ts)

Remove inline `x-relation-id` validation from `getResidentsWithRobotsByOrganization` (lines 88-99) — now handled by middleware. Read `relationId` from `(req as any).relationId` instead.

```diff
 public getResidentsWithRobotsByOrganization = async (req, res) => {
   const ctx = getContext(req)
-  const relationIdHeader = req.get('x-relation-id')
-  if (!relationIdHeader) {
-    res.status(400).json({ message: 'x-relation-id header is required' })
-    return
-  }
-  const relationId = Number(relationIdHeader)
-  if (isNaN(relationId) || relationId <= 0) {
-    res.status(400).json({ message: 'Invalid relationId provided' })
-    return
-  }
+  const relationId = (req as any).relationId
   const residents = await this._residentService.getResidentsWithRobots(relationId, ctx)
   res.status(200).json(residents)
 }
```

### Phase 2: Update Tests for `x-relation-id` Middleware ✅

#### [MODIFY] [ResidentControllerIT.ts](file:///Users/kai/work/aweave/workspaces/tinybots/backend/sensara-adaptor/test/controller/ResidentControllerIT.ts)

**2.1 — Add `x-relation-id` validation tests for external endpoints**

Add tests to verify that external endpoints return `400` when `x-relation-id` is missing or invalid. These tests apply to all 6 external endpoints.

**2.2 — Ensure all 6 external endpoint test groups pass `x-relation-id` header**

External endpoint tests that currently don't set `x-relation-id` need to be updated to include the header (since middleware will now require it).

---

## Verification Plan

### Automated Tests

```bash
just -f workspaces/devtools/tinybots/local/Justfile test-sensara-adaptor
```

### Build Verification

```bash
cd workspaces/tinybots/backend/sensara-adaptor && yarn run build
```

## Implementation Notes / As Implemented

- Added `src/middleware/relationIdMiddleware.ts` to validate `x-relation-id` (required + positive integer) and attach parsed `relationId` to the Express request.
- Wired `relationIdMiddleware` into all 6 external Sensara resident endpoints in `src/App.ts`, placed before path/body validators so header validation fails first with `400`.
- Removed duplicate inline `x-relation-id` parsing/validation from `ResidentController.getResidentsWithRobotsByOrganization`; it now reads the middleware-provided value.
- Updated `test/controller/ResidentControllerIT.ts`:
  - Added table-driven `400` tests (missing + invalid `x-relation-id`) covering all 6 external endpoints.
  - Added a reusable `withRelationId(...)` helper and updated external endpoint tests to send the required header.
  - Preserved internal endpoint auth/permission tests and external endpoint no-auth behavior.
- Verification performed:
  - `yarn run build` in `workspaces/tinybots/backend/sensara-adaptor` (exit code `0`)
  - Did not run `just ... test-sensara-adaptor` (not requested)
