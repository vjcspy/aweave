# [260228-Fix-ReturnReason-Concatenation] - Fix returnReason Overwrite in CreateReturn

## References

- `workspaces/tinybots/frontend/wonkers-dash-admin/src/app/components/orders/detailed/CreateReturn/redux/reducer.ts`
- `workspaces/tinybots/frontend/wonkers-dash-admin/src/app/components/orders/detailed/CreateReturn/redux/thunks.ts`
- `workspaces/tinybots/frontend/wonkers-dash-admin/src/app/components/orders/detailed/CreateReturn/Form/ReturnInfo/ReturnInfoForm.tsx`
- `workspaces/tinybots/frontend/wonkers-dash-admin/src/app/components/orders/detailed/CreateReturn/types/ReturnForm.schema.json`

## User Requirements

When creating a return, if there are multiple `returnReason` fields (e.g. from return concepts or multiple dispatches), all reasons should be combined into a comma-separated string. Currently, each new `returnReason` value overwrites the previous one.

```
Note: in the example below there are multiple return reasons, if there are multiple reasons,
that should be added as comma separated string, this does not happen and the reason is overwritten.

To reproduce:
  - create a return
  - a return concept has a returnReason pre-filled
  - add/change the returnReason field

Expected result:
  All fields with return reason are added to a comma separated list.
```

## Objective

Fix the `updateReturnForm` reducer in `reducer.ts` so that dispatching a new `returnReason` when one already exists in state concatenates the values with `,` instead of overwriting.

### Key Considerations

- Backend schema accepts `returnReason` as a single string with `maxLength: 1024` — concatenation must stay within this limit.
- The fix must not affect cases where only one reason is provided (no change in behavior).
- Duplicate reasons must not be added (check before concatenating).
- No change to backend, only frontend `reducer.ts` needs to be updated.

## Implementation Plan

### Phase 1: Root Cause Analysis

- [x] Identify that `updateReturnForm` reducer uses a plain spread merge:

  ```ts
  state.returnForm = prepareReturnConcept({ ...state.returnForm, ...copiedPayload })
  ```

  This overwrites `returnReason` from state whenever a new payload has it.
- [x] Confirm that `prepareReturnConcept` simply passes `returnReason` through without concatenation.
- [x] Backend schemas confirm `returnReason` is a plain `string` — no array support.

### Phase 2: Implementation Structure

```
workspaces/tinybots/frontend/wonkers-dash-admin/
└── src/app/components/orders/detailed/CreateReturn/redux/
    ├── reducer.ts          # 🚧 TODO - concatenate returnReason in updateReturnForm
    └── reducer.test.ts     # 🆕 NEW  - unit tests for returnReason concatenation logic
```

### Phase 3: Detailed Implementation Steps

- [ ] Update `updateReturnForm` in `reducer.ts`
  - Before merging `copiedPayload` into state, check if both `state.returnForm.returnReason` and `copiedPayload.returnReason` are non-empty strings.
  - If so, and if the new reason is not already present in the existing string, concatenate with `,`.
  - If the new reason is already included, keep the existing state value unchanged.
  - If only one side has a value, keep that value (no change in behavior).

  ```ts
  // Concatenate returnReason instead of overwriting
  if (
    state.returnForm.returnReason &&
    copiedPayload.returnReason &&
    state.returnForm.returnReason !== copiedPayload.returnReason
  ) {
    const existingReasons = state.returnForm.returnReason.split(', ')
    if (!existingReasons.includes(copiedPayload.returnReason)) {
      copiedPayload.returnReason = [state.returnForm.returnReason, copiedPayload.returnReason].join(', ')
    } else {
      copiedPayload.returnReason = state.returnForm.returnReason
    }
  }
  ```

- [ ] Create `reducer.test.ts` with tests covering:
  - Setting reason on empty state → just sets the value
  - Dispatching a second different reason → concatenates with `,`
  - Dispatching the same reason twice → does not duplicate
  - Dispatching with no existing reason → just sets the new value

- [ ] Run Jest tests to validate

  ```bash
  cd workspaces/tinybots/frontend/wonkers-dash-admin
  npx jest --testPathPattern="reducer.test" --no-coverage
  ```

## Summary of Results

- [To be updated after implementation is complete]
