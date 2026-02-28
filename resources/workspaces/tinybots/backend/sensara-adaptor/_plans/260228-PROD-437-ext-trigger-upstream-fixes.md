# [260228-PROD-437-ext-trigger-upstream-fixes] - [PROD-437 External Trigger Upstream Fixes]

## References

- `resources/workspaces/tinybots/backend/sensara-adaptor/_plans/260225-PROD-437-ext-endpoint-restructure.md`
- `workspaces/tinybots/backend/sensara-adaptor/src/controller/ResidentController.ts`
- `workspaces/tinybots/backend/sensara-adaptor/src/model/dto/TriggerSubscriptionDto.ts`
- `workspaces/tinybots/backend/tiny-internal-services/lib/services/EventService.ts`
- `workspaces/tinybots/backend/megazord-events/src/cmd/app/main.ts`
- `workspaces/tinybots/backend/megazord-events/src/services/EventSubscriptionService.ts`
- `workspaces/tinybots/backend/megazord-events/src/models/domains/SubscriptionDomain.ts`

## User Requirements

`resources/workspaces/tinybots/backend/sensara-adaptor/_plans/260225-PROD-437-ext-endpoint-restructure.md`
Sau khi làm xong vẫn còn mấy issue như sau:
1. check trả về 404 thay vì 500
```
what did you do?
DELETE unknown subscription Id:
curl -X 'DELETE' \
  'https://api.tinybots.academy/ext/v1/sensara/residents/d37b9b20-b03e-44f2-8131-8e9b0c162162/events/subscriptions/triggers/99999999' \
  -H 'accept: */*' \
  -H 'Authorization: Bearer [TOKEN]'
  
What happened?
500
What did you expect?
404
---
what did you do?
Try to delete a subscription for another robot
curl -X 'DELETE' \
  'https://api.tinybots.academy/ext/v1/sensara/residents/d37b9b20-b03e-44f2-8131-8e9b0c162162/events/subscriptions/triggers/468' \
  -H 'accept: */*' \
  -H 'Authorization: Bearer [TOKEN]'
  
What happened?
500
What did you expect?
404 trigger not found
---
What did you do?
Create trigger for nonexisting resident
curl -X 'POST' \
  'https://api.tinybots.academy/ext/v1/sensara/residents/d37b9b20-b03e-44f2-8131-8e9b/events/subscriptions/triggers' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer [TOKEN]' \
  -H 'Content-Type: application/json' \
  -d '{
  "eventName": "DOES_NOT_EXIST"
}'
What happened?
404 Resident robot was not found
What did you expect?
404 Resident was not found
```
Lý do có lỗi này là do đang consume từ `workspaces/tinybots/backend/tiny-internal-services`. it is wrapping all error from downstream to internal error -> we should check 404 status code and return appropiate error code

2. check and verify why we can delete non-subscription trigger
```
what did you do?
DELETE a non trigger subscription:
curl -X 'DELETE' \
  'https://api.tinybots.academy/ext/v1/sensara/residents/d37b9b20-b03e-44f2-8131-8e9b0c162162/events/subscriptions/triggers/495' \
  -H 'accept: */*' \
  -H 'Authorization: Bearer [TOKEN]'
  
What happened?
204
What did you expect?
404 trigger not found
```

3. validate if eventName before procees
```
What did you do?
Create trigger for nonexisting event
curl -X 'POST' \
  'https://api.tinybots.academy/ext/v1/sensara/residents/d37b9b20-b03e-44f2-8131-8e9b0c162162/events/subscriptions/triggers' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer [TOKEN]' \
  -H 'Content-Type: application/json' \
  -d '{
  "eventName": "DOES_NOT_EXIST"
}'
What happened?
500
What did you expect?
400 EVENT does not exist
```

1. fix luôn upstream (tiny-internal-services + megazord-events)
2. eventName hợp lệ theo tập nào: toàn bộ TinybotsEvent
3. Message exact bạn muốn cho 3 case -> dùng đúng như bạn suggest

## Objective

Fix external Sensara trigger endpoints by aligning cross-service behavior across adaptor and upstream dependencies so that trigger-specific validation and error mapping produce correct HTTP status codes and exact response messages.

### Key Considerations

- Keep changes consistent across three repositories: `sensara-adaptor`, `tiny-internal-services`, and `megazord-events`.
- Preserve existing successful flows while fixing only trigger-specific error handling and validation.
- Ensure `DELETE .../subscriptions/triggers/:subscriptionId` cannot deactivate non-trigger subscriptions.
- Validate `eventName` against the full `TinybotsEvent` set before downstream processing.
- Return exact external messages:
  - `404 Trigger not found`
  - `404 Resident was not found`
  - `400 EVENT does not exist`
- Follow user constraint: do not add new tests unless explicitly requested.

## Implementation Plan

### Phase 1: Analysis & Preparation

- [ ] Analyze detailed requirements
  - **Outcome**: Confirm exact expected status/message contract for all reported scenarios and define ownership per repository.
- [ ] Define scope and edge cases
  - **Outcome**: Identify edge cases including unknown subscription ID, cross-robot ID, non-trigger ID on trigger endpoint, unknown resident, and invalid event name.
- [ ] Evaluate existing test structures and define test cases
  - **Outcome**: Identify existing integration coverage and verification approach without introducing new tests, unless requested later.

### Phase 2: Implementation Structure

```
workspaces/tinybots/backend/
├── sensara-adaptor/
│   ├── src/controller/ResidentController.ts        # 🚧 TODO - align external messages and downstream NotFound mapping for trigger delete
│   └── src/model/dto/TriggerSubscriptionDto.ts     # 🚧 TODO - validate eventName using TinybotsEvent enum
├── tiny-internal-services/
│   └── lib/services/EventService.ts                # 🚧 TODO - preserve downstream 404 as NotFoundError for trigger APIs
└── megazord-events/
    ├── src/controllers/EventSubscriptionsController.ts # 🚧 TODO - add trigger-specific delete controller method for trigger route
    ├── src/cmd/app/main.ts                         # 🚧 TODO - route trigger delete to trigger-only unsubscribe path
    └── src/services/EventSubscriptionService.ts    # 🚧 TODO - enforce TRIGGER_SUBSCRIPTION check before deactivation
```

### Phase 3: Detailed Implementation Steps

- [ ] Update `tiny-internal-services` trigger API client error handling
  - Map downstream `404` to `NotFoundError` in `postTriggerSubscription`, `getTriggerSubscription`, and `deleteTriggerSubscription`.
  - Preserve existing internal-error behavior for non-404 failures.
- [ ] Update `megazord-events` trigger delete semantics
  - Add trigger-specific unsubscribe logic that checks `subscriptionType === TRIGGER_SUBSCRIPTION`.
  - Return `NotFoundError` when subscription exists but is not trigger type.
  - Add trigger-specific controller wrapper method (e.g. `deleteTriggerSubscription`) to invoke trigger-only unsubscribe logic.
  - Wire `/internal/v1/events/robots/:robotId/subscriptions/triggers/:subscriptionId` to trigger-specific delete handling.
- [ ] Update `sensara-adaptor` external trigger contract
  - Validate `eventName` against full `TinybotsEvent` using `@IsEnum(TinybotsEvent, { message: 'EVENT does not exist' })`.
  - Return `400 EVENT does not exist` on invalid eventName.
  - Return `404 Resident was not found` for missing resident cases.
  - Wrap `_eventService.deleteTriggerSubscription(...)` in `try...catch` and map not-found errors to `NotFoundError('Trigger not found')`.
  - Return `404 Trigger not found` for missing/non-trigger/cross-robot trigger deletion.
- [ ] Build verification
  - Run build in each touched repository and confirm compilation success.
  - Capture any follow-up needed for deployment sequencing (upstream first, adaptor second).

## Summary of Results

### Completed Achievements

- [To be updated after implementation is complete]
