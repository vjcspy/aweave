# 📋 [BUG-USECLIENTADDRESS-NULL: 2026-02-13] - Fix crash when `useClientAddress` question has no answer

## References

- Global overview: `resources/workspaces/tinybots/OVERVIEW.md`
- Repo overview: `resources/workspaces/tinybots/backend/wonkers-nedap/OVERVIEW.md`
- Existing related plan: `resources/workspaces/tinybots/backend/wonkers-nedap/260121-implement-hardware-type-parsing.md`
- Flow documentation: `resources/workspaces/tinybots/backend/wonkers-nedap/Nedap-retrieve-concepts-flow.md`

Code references (current bug location):

- `workspaces/tinybots/backend/wonkers-nedap/src/mappers/ConceptOrderMapper.ts`
- `workspaces/tinybots/backend/wonkers-nedap/src/mappers/ConceptReturnMapper.ts`
- `workspaces/tinybots/backend/wonkers-nedap/src/mappers/mapSurvey.ts`
- `workspaces/tinybots/backend/wonkers-nedap/src/service/SurveyService.ts`
- `workspaces/tinybots/backend/wonkers-nedap/test/mappers/ConceptOrderMapperTest.ts`

## User Requirements

> Người dùng yêu cầu tạo plan fix lỗi:
>
> `TypeError: Cannot read properties of undefined (reading 'text')`
>
> và lưu plan tại `resources/workspaces/tinybots/backend/wonkers-nedap/_plans`.

## 🎯 Objective

Fix triệt để crash khi mapper đọc `configAnswer.answer.text` trong trường hợp câu hỏi `useClientAddress` tồn tại nhưng không có `answer` trong survey result.

### ⚠️ Key Considerations

- Root cause là null-safety thiếu trong code mapper; dữ liệu thiếu `answer` là condition kích hoạt.
- Cùng pattern đang tồn tại ở cả `ConceptOrderMapper` và `ConceptReturnMapper`; cần fix đồng bộ để tránh lỗi tương tự.
- Không thay đổi business behavior hiện tại:
  - Nếu không xác định được `useClientAddress` thì fallback `false`.
  - Không làm thay đổi mapping `hardwareType`.
- Cần thêm regression tests cho case `useClientAddress` có question nhưng không có answer.

## 🔄 Implementation Plan

### Phase 1: Analysis & Preparation

- [x] Confirm failure path from production stack trace to source code
  - **Outcome**: Chốt chính xác điểm crash tại `canUseClientLocation` của `ConceptOrderMapper`.
- [ ] Define edge-case matrix cho `useClientAddress`
  - **Outcome**: Bảng case cho `answer` missing, empty text, `yes/ja`, `no/nee`, khác giá trị.
- [x] Identify all duplicated risk points
  - **Outcome**: Danh sách tất cả mapper/hàm có pattern `.answer.text` không null guard.
- [x] Review existing tests and decide minimal regression coverage
  - **Outcome**: Test cases mới cho order mapper và return mapper.

### Phase 2: Implementation (File/Code/Test Structure)

```
workspaces/tinybots/backend/wonkers-nedap/
├── src/
│   ├── mappers/
│   │   ├── ConceptOrderMapper.ts      # 🚧 TODO - null-safe guard for useClientAddress parsing
│   │   └── ConceptReturnMapper.ts     # 🚧 TODO - same guard to prevent mirrored crash
│   └── mappers/mappingUtils.ts        # 🔍 VERIFY - optional helper if shared normalization is extracted
└── test/
    ├── mappers/
    │   ├── ConceptOrderMapperTest.ts  # 🚧 TODO - add regression tests (missing answer)
    │   └── ConceptReturnMapperTest.ts # 🚧 TODO - add regression tests (missing answer)
    └── service/
        └── SurveyServiceTest.ts       # 🔍 VERIFY - optional integration-level coverage
```

### Phase 3: Detailed Implementation Steps

#### 3.1 Harden `ConceptOrderMapper.canUseClientLocation`

- Replace direct access `configAnswer.answer.text` with null-safe read.
- Normalization logic:
  - `const normalizedAnswer = (configAnswer.answer?.text ?? '').toLowerCase()`
- Keep existing behavior for accepted values:
  - `yes`, `ja` => `true`
  - others or missing => `false`

#### 3.1.5 Harden `ConceptOrderMapper.getDeliveryAddress`

- Protect `addressProperties[0].groupId` with null-safe guard (e.g., `addressProperties[0]?.groupId`) or early return when `addressProperties.length === 0`.
- This prevents a related crash on the same path if the delivery address questions are entirely missing or filtered out.

#### 3.2 Harden `ConceptReturnMapper.canUseClientLocation`

- Apply same null-safe fix to maintain consistency and prevent future crash in return flow.
- Ensure behavior parity with order mapper.

#### 3.3 Optional refactor (only if needed)

- If duplication is high, extract tiny helper for answer normalization.
- Keep scope minimal; do not broaden refactor outside bug fix unless required by tests.

#### 3.4 Add regression tests (mandatory)

- `ConceptOrderMapper` tests:
  - Case A: `useClientAddress` question present, `answer` missing => no throw, returns `false`.
  - Case B: `useClientAddress` question present, `answer.text = 'Ja'` => `true`.
  - Case C: `useClientAddress` question present, `answer.text = ''` => `false`.
  - Case D: `addressProperties` array is empty => no throw, address handling fails gracefully.
- `ConceptReturnMapper` tests:
  - Mirror case A/B/C.

#### 3.5 Validate end-to-end stability

- Run mapper unit tests and relevant service tests.
- Verify no regression for delivery address mapping and lazy client address flow.
- Verify existing hardwareType tests remain green.

#### 3.6 Deployment and rollback notes

- Deployment risk: low (pure null-safety + tests).
- Rollback: revert mapper changes if unexpected behavior appears in address inference.

## 📊 Summary of Results

> Do not summarize results until implementation is completed and explicitly requested.

### ✅ Completed Achievements

- [ ] N/A (plan only)

## 🚧 Outstanding Issues & Follow-up

### ⚠️ Issues/Clarifications (Optional)

- [ ] Confirm whether unknown localized values beyond `yes/ja/no/nee` are expected from ONS for `useClientAddress`.
- [ ] Decide whether to add a warning log when `useClientAddress` question exists but answer is missing.

## Implementation Notes / As Implemented

- Implemented null-safe access for `useClientAddress` answer parsing in both mappers:
  - `workspaces/tinybots/backend/wonkers-nedap/src/mappers/ConceptOrderMapper.ts`
  - `workspaces/tinybots/backend/wonkers-nedap/src/mappers/ConceptReturnMapper.ts`
- `ConceptOrderMapper.getDeliveryAddress` now guards `addressProperties[0]` with optional chaining to prevent crashes when no delivery-address questions are present.
- Added regression tests for `useClientAddress` parsing in:
  - `workspaces/tinybots/backend/wonkers-nedap/test/mappers/ConceptOrderMapperTest.ts`
  - `workspaces/tinybots/backend/wonkers-nedap/test/mappers/ConceptReturnMapperTest.ts`
- Added order mapper regression coverage for missing delivery-address questions (`addressProperties` empty) to verify no throw and fallback `false`.
- Validation:
  - Source diff reviewed locally.
  - Attempted TypeScript check with `yarn run tsc --noEmit`, but local Yarn workspace lockfile state blocked execution (`package doesn't seem to be present in your lockfile`).
  - No test suite executed in this run.
