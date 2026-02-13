---
confluence_sync:
  page:
    id: "4563369987"
    url: "https://tinybots.atlassian.net/wiki/spaces/~712020e960f9fdcdbd471a860cb5e759b69588/pages/4563369987/useClientAddress+Null+Answer+Crash"
    space_key: "~712020e960f9fdcdbd471a860cb5e759b69588"
    title: "useClientAddress Null Answer Crash"
  sync:
    direction_default: "both"
    include_only_listed_sections: true
    preserve_unmanaged_remote_content: true
  approval:
    require_for_down: true
    source: "confluence_labels"
    any_of_labels:
      - "approved"
      - "po-approved"
      - "qe-approved"
  sections:
    - key: "flow_context"
      local_heading: "## 4. End-to-End Flow Context"
      remote_heading: "## Flows"
      direction: "both"
      status: "approved"
      transform: "po_qe_readable"
      last_sync:
        page_version: 6
        synced_at: ""
        local_hash: ""
        remote_hash: ""
    - key: "fix_plan_option_a"
      local_heading: "## Option A - Immediate robustness hotfix (recommended)"
      remote_heading: "## Fix Plan"
      direction: "both"
      status: "approved"
      transform: "po_qe_readable"
      last_sync:
        page_version: 6
        synced_at: ""
        local_hash: ""
        remote_hash: ""
  context_files:
    - "devdocs/projects/tinybots/backend/wonkers-nedap/Nedap-retrieve-concepts-flow.md"
    - "devdocs/projects/tinybots/backend/wonkers-nedap/_plans/260213-fix-use-client-address-null-answer.md"
---

# Incident Analysis - `useClientAddress` Null Answer Crash (wonkers-nedap)

## 1. Audience & Purpose

- **Audience**: Technical Leader
- **Purpose**: Explain the system flow, failure conditions, root cause, impact, and next-action options at technical/operational level.
- **Scope**: Incident in the retrieve-concepts flow from Nedap ONS to TinyBots; this document is not an implementation guide.

## 2. Executive Summary

During concept order retrieval, `wonkers-nedap` crashes with:

`TypeError: Cannot read properties of undefined (reading 'text')`

The exception occurs in `ConceptOrderMapper.canUseClientLocation`, because the code directly reads `configAnswer.answer.text` when `answer` is missing.

Conclusion:
- **Primary root cause is missing null-safety in code**.
- **Missing `answer` in ONS data is the trigger condition**.
- The same risk pattern exists in the return mapper and may cause similar failures in return flow.

## 3. Timeline Snapshot (from observed logs)

### 2026-02-11
- Error appears in order-mapping stack trace at `ConceptOrderMapper.canUseClientLocation`.
- The system then continues with return retrieval.

### 2026-02-13
- Same error recurs:
  - `TypeError: Cannot read properties of undefined (reading 'text')`
  - Stack trace points to `ConceptOrderMapper.canUseClientLocation`.
- Immediately after, logs show `Getting returns from integration nedap_ons`.

Interpretation:
- Order retrieval for one integration fails in mapper.
- Overall retrieve flow still proceeds to returns due to catch boundaries between order and return stages.

## 4. End-to-End Flow Context

```text
[Tester/Admin]
    |
    | click "Retrieve latest"
    v
[wonkers-dash-admin]
    |
    | POST /v4/admin/taas-orders/concepts/retrieve
    v
[wonkers-taas-orders]
    |
    | POST /internal/v1/nedap-ons/orders/retrieve
    v
[wonkers-nedap]
    |
    | getAllNewOrders()
    |   -> pull from ONS (surveys/results/clients)
    |   -> map with ConceptOrderMapper.map()
    |   -> crash if useClientAddress.answer is missing
    |
    | getAllNewReturns()
    |   -> pull return surveys/results from ONS
    v
[Response returned to caller]
```

Source references:
- Order retrieval mapping call: `projects/tinybots/backend/wonkers-nedap/src/service/SurveyService.ts:64`
- Stage loops + catch (orders/returns): `projects/tinybots/backend/wonkers-nedap/src/service/SurveyService.ts:84`, `projects/tinybots/backend/wonkers-nedap/src/service/SurveyService.ts:153`
- Orchestration order-first then returns: `projects/tinybots/backend/wonkers-nedap/src/service/ConceptService.ts:166`

## 5. Technical Root Cause

### 5.1 Failing line

In `ConceptOrderMapper`:
- `configAnswer.answer.text` is accessed directly without null-safety.
- Reference: `projects/tinybots/backend/wonkers-nedap/src/mappers/ConceptOrderMapper.ts:245`

### 5.2 Why `answer` can legitimately be missing

`mapSurvey` builds `answeredQuestions` from full survey definition, not only answered items.
- If no matching answer exists in `surveyResult.answers`, the question still exists but `answer` is undefined.
- Reference: `projects/tinybots/backend/wonkers-nedap/src/mappers/mapSurvey.ts:87`

The model explicitly allows this:
- `answer?: SurveyAnswer`
- Reference: `projects/tinybots/backend/wonkers-nedap/src/model/NedapOns/SurveyQuestion.ts:27`

### 5.3 Runtime trigger condition

The crash occurs when all are true:
1. `deliveryAddress.zipcode == null` (this enables `useClientAddress` branch)
2. A `useClientAddress` question exists in the relevant group
3. That question has no `answer`

Trigger branch reference:
- `projects/tinybots/backend/wonkers-nedap/src/mappers/ConceptOrderMapper.ts:217`

## 6. Is It a Data Problem or a Code Problem?

Short answer:
- **Code problem (primary)**: mapper assumes `answer` is always present.
- **Data/contract variance (secondary)**: ONS payload can omit `answer` for some questions.

Leadership framing:
- This is an integration-boundary robustness issue.
- The service should not rely on upstream payload completeness to avoid crashes.

## 7. Blast Radius & Risk

### 7.1 Current observed impact

- Order retrieval for the affected integration can fail for that batch.
- Returns can still continue (as seen in logs and orchestration design).

### 7.2 Latent risk

The same pattern exists in `ConceptReturnMapper`:
- Reference: `projects/tinybots/backend/wonkers-nedap/src/mappers/ConceptReturnMapper.ts:199`
- This means return flow can hit the same class of failure with similar payload shape.

### 7.3 Business risk

- Concept orders may be delayed or not created when retrieval hits triggering payloads.
- Ops/test may observe unstable behavior (some forms succeed, some fail) even with correct survey linking.

## 8. Decision Options for Next Action

## Option A - Immediate robustness hotfix (recommended)

- Add null-safe handling for `useClientAddress` parsing in order + return mappers.
- Add regression tests for "question exists, answer missing".

Pros:
- Stops recurrence quickly.
- Small scope, low deployment risk.

Cons:
- Does not fully resolve upstream contract ambiguity; it improves resilience.

## Option B - Enforce strict upstream contract only

- Coordinate with ONS/form owner to guarantee `useClientAddress` always has an answer.

Pros:
- Cleaner upstream data.

Cons:
- Timeline is externally controlled.
- Does not protect against other null/missing fields.

## Option C - Combined approach (strategic)

- Execute Option A now.
- In parallel, align contract/testing checklist with tester + ONS form owner.

Pros:
- Immediate risk reduction + long-term integration governance improvement.

Cons:
- Requires cross-team coordination.

## 9. Recommended Next Actions (Leadership)

1. **Approve Option C**:
- Deliver null-safety hotfix + regression tests in current sprint.
- Open follow-up action with tester/form owner on payload contract expectations.

2. **Operational guardrail**:
- Add dedicated alert/error tagging for `useClientAddress` parse failures to track recurrence.

3. **Data governance**:
- Require test datasets for every new form to include branch-driving fields (e.g., `useClientAddress`) in both answered and missing states.

4. **Release-note alignment**:
- Communicate this as an integration robustness incident, not a business-rule change.

## 10. Supporting References

- `projects/tinybots/backend/wonkers-nedap/src/mappers/ConceptOrderMapper.ts:217`
- `projects/tinybots/backend/wonkers-nedap/src/mappers/ConceptOrderMapper.ts:245`
- `projects/tinybots/backend/wonkers-nedap/src/mappers/ConceptReturnMapper.ts:199`
- `projects/tinybots/backend/wonkers-nedap/src/mappers/mapSurvey.ts:87`
- `projects/tinybots/backend/wonkers-nedap/src/service/SurveyService.ts:64`
- `projects/tinybots/backend/wonkers-nedap/src/service/SurveyService.ts:84`
- `projects/tinybots/backend/wonkers-nedap/src/service/SurveyService.ts:153`
- `projects/tinybots/backend/wonkers-nedap/src/service/ConceptService.ts:166`
- `devdocs/projects/tinybots/backend/wonkers-nedap/Nedap-retrieve-concepts-flow.md`
- `devdocs/projects/tinybots/backend/wonkers-nedap/_plans/260213-fix-use-client-address-null-answer.md`
