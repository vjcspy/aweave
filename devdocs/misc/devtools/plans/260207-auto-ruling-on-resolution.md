# 260207 - Auto Ruling on Resolution

## References

- `devdocs/misc/devtools/plans/debate.md` — Debate spec (nghiệp vụ + hệ thống)
- `devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md` — NestJS debate module overview
- `devtools/common/nestjs-debate/src/argument.service.ts` — ArgumentService (core logic)
- `devtools/common/nestjs-debate/src/debate.controller.ts` — REST controller
- `devtools/common/debate-machine/src/machine.ts` — xstate state machine definition

## User Requirements

Trong giai đoạn này, khi nhận yêu cầu từ Proposer để complete (`request-completion` / RESOLUTION) thì server sẽ auto submit `submit_ruling` (close=true) thay cho Arbitrator luôn — debate tự động close mà không cần Arbitrator can thiệp thủ công.

## Objective

Khi Proposer submit RESOLUTION, server tự động tạo thêm một bản ghi RULING với `close=true` ngay sau đó, giúp debate chuyển thẳng sang `CLOSED` mà không cần chờ Arbitrator.

### Key Considerations

- **Chỉ áp dụng cho RESOLUTION, không áp dụng cho APPEAL** — APPEAL vẫn cần Arbitrator phán xử thủ công
- **Giữ nguyên 2 bản ghi** — RESOLUTION (seq N) + RULING (seq N+1) đều được lưu vào DB để conversation history đầy đủ
- **WebSocket broadcast** — cả 2 argument (RESOLUTION, RULING) đều được broadcast, debate-web nhận được cả 2 events
- **CLI poll** — agent đang poll sẽ nhận cả RESOLUTION và RULING, cuối cùng thấy state=`CLOSED` → action `debate_closed`
- **Idempotency** — nếu client retry `request-completion` với cùng `client_request_id`, RESOLUTION trả existing result, auto-ruling không chạy lại (vì `isExisting=true`)
- **Error handling** — nếu auto-ruling fail (edge case), RESOLUTION vẫn thành công, debate ở state `AWAITING_ARBITRATOR`, Arbitrator vẫn có thể ruling thủ công

## Implementation Plan

### Phase 1: Analysis

- [x] Đọc hiểu flow hiện tại: `submitResolution()` → RESOLUTION → state `AWAITING_ARBITRATOR` → chờ Arbitrator
- [x] Đọc hiểu `submitRuling()` → RULING → state `CLOSED` (khi close=true)
- [x] Xác nhận cả 2 method đều đi qua `submitArgument()` — locking, state validation, seq, broadcast đều tự động

### Phase 2: Implementation

**Flow hiện tại:**

```
Proposer: request-completion
  → RESOLUTION (seq N) → state: AWAITING_ARBITRATOR
  → [Chờ Arbitrator thủ công submit RULING]
  → RULING (seq N+1) → state: CLOSED
```

**Flow mới:**

```
Proposer: request-completion
  → RESOLUTION (seq N) → state: AWAITING_ARBITRATOR
  → [Server auto] RULING (seq N+1) → state: CLOSED
  ← Return RESOLUTION result cho CLI
```

**File cần sửa:**

```
devtools/common/nestjs-debate/
└── src/
    └── argument.service.ts          # 🔄 Sửa submitResolution() — thêm auto-ruling
```

### Phase 3: Detailed Implementation Steps

#### Step 1: Sửa `submitResolution()` trong `argument.service.ts`

**Hiện tại** (line 219–234):

```typescript
async submitResolution(input: {
  debate_id: string;
  target_id: string;
  content: string;
  client_request_id: string;
}) {
  return this.submitArgument({
    debate_id: input.debate_id,
    role: 'proposer',
    parent_id: input.target_id,
    type: 'RESOLUTION',
    content: input.content,
    client_request_id: input.client_request_id,
    action_name: 'submit_resolution',
  });
}
```

**Sau khi sửa:**

```typescript
async submitResolution(input: {
  debate_id: string;
  target_id: string;
  content: string;
  client_request_id: string;
}) {
  const result = await this.submitArgument({
    debate_id: input.debate_id,
    role: 'proposer',
    parent_id: input.target_id,
    type: 'RESOLUTION',
    content: input.content,
    client_request_id: input.client_request_id,
    action_name: 'submit_resolution',
  });

  // Auto-ruling: tự động close debate khi RESOLUTION được tạo thành công
  // Chỉ auto-ruling nếu RESOLUTION thực sự mới (không phải idempotency hit)
  if (!result.isIdempotencyHit) {
    try {
      await this.submitArgument({
        debate_id: input.debate_id,
        role: 'arbitrator',
        parent_id: null,
        type: 'RULING',
        content: 'Auto-approved: Debate completed as requested by proposer.',
        client_request_id: null,
        action_name: 'submit_ruling',
        close: true,
      });
    } catch {
      // Nếu auto-ruling fail, RESOLUTION vẫn thành công
      // Arbitrator có thể ruling thủ công sau
    }
  }

  return result;
}
```

**Giải thích:**

1. Gọi `submitArgument()` cho RESOLUTION — state chuyển sang `AWAITING_ARBITRATOR`, broadcast qua WS
2. Nếu không phải idempotency hit → gọi tiếp `submitArgument()` cho RULING (close=true) — state chuyển sang `CLOSED`, broadcast qua WS
3. `submitArgument()` tự handle lock, transaction, seq assignment, state validation — không cần logic thêm
4. `client_request_id: null` vì đây là server-generated, không cần idempotency
5. Return RESOLUTION result cho caller (CLI nhận `argument_id` của RESOLUTION)

#### Step 2: Expose `isIdempotencyHit` từ `submitArgument()`

Hiện tại `submitArgument()` return `{ debate, argument }` (line 181) nhưng bên trong transaction có field `isExisting` (line 96, 162). Cần expose ra ngoài:

**Sửa line 181:**

```typescript
// Hiện tại
return { debate: result.debate, argument: result.argument };

// Sửa thành
return {
  debate: result.debate,
  argument: result.argument,
  isIdempotencyHit: result.isExisting,
};
```

Các caller khác (`submitClaim`, `submitAppeal`, etc.) không sử dụng field này nên không bị ảnh hưởng.

#### Step 3: Cập nhật documentation

Cập nhật `devdocs/misc/devtools/plans/debate.md` section **1.1.5** (Step5) để phản ánh behavior mới:

> **1.1.5** Step5 2 bên đều nhất trí hết các điểm:
> Lúc đó `Proposer` sẽ gọi `aw debate request-completion` để tạo bản ghi `RESOLUTION`. **Server sẽ tự động tạo bản ghi `RULING` với close=true**, chuyển state sang `CLOSED`. Cả 2 `Proposer` và `Opponent` sẽ nhận `debate_closed` khi poll.

Cập nhật `devdocs/misc/devtools/common/nestjs-debate/OVERVIEW.md` — thêm note về auto-ruling behavior.

## Summary

Chỉ cần sửa **1 file source code** (`argument.service.ts`) với 2 thay đổi nhỏ:
1. `submitResolution()`: thêm auto-ruling logic sau khi tạo RESOLUTION
2. `submitArgument()` return: expose `isIdempotencyHit`

Không cần sửa state machine, controller, gateway, hay CLI. Toàn bộ locking, state validation, seq assignment, WebSocket broadcast đã được `submitArgument()` handle sẵn.
