# 📘 Server-side Action-driven Architecture

## Using Jotai (Vanilla) + RxJS (Epic-style)

---

## 1. Problem Statement & Design Goals

Chúng ta xây dựng một **long-running server application** đóng vai trò như một **“brain”**:

* Server **nhận request / message**
* Chuyển request thành **Action**
* Xử lý **side effects** (IO, workflow, business logic)
* Khi hoàn tất, **phát Event** để:

  * thông báo client qua WebSocket
  * hoặc trigger bước tiếp theo trong workflow
* Server **giữ state nội bộ** để:

  * trace tiến trình
  * phục vụ resync / query
  * *không* phải để broadcast liên tục

### Non-goals

* Không phải AI engine
* Không xử lý high-frequency real-time ticks
* Không cần event sourcing đầy đủ (append-only log)

---

## 2. Core Architectural Principles

### 2.1 Action-driven (not state-driven)

* **Action** là input duy nhất đi vào hệ thống
* Không component / handler nào được mutate state trực tiếp
* Mọi thay đổi đều bắt nguồn từ Action

```
Request → Action → Side Effect → Action → State / Event
```

---

### 2.2 Single Runtime Scope

* Một **Engine instance** = một runtime logic
* Bao gồm:

  * `actions$` (RxJS Subject)
  * `epics` (side effects)
  * `jotai store` (state container)

> “Global shared” nghĩa là **shared runtime instance**,
> không phải state to hay nhỏ.

---

### 2.3 Jotai dùng để làm gì?

**Jotai KHÔNG phải reducer framework** ở đây.

Jotai được dùng vì:

* State chia nhỏ theo feature (granular)
* Có thể chạy **không cần React** (`jotai/vanilla`)
* Commit state có thể kiểm soát chặt (command atoms)

👉 Jotai = **in-memory state graph**, không phải dispatcher.

---

### 2.4 RxJS dùng để làm gì?

RxJS **chỉ dùng cho orchestration & side effects**:

* debounce / throttle
* cancel / retry
* async workflow
* IO coordination

👉 RxJS **KHÔNG mutate state trực tiếp**.

---

## 3. High-level Architecture Diagram

```
                ┌─────────────┐
                │ HTTP / WS   │
                └─────┬───────┘
                      │
                  Action
                      │
                ┌─────▼───────┐
                │ actions$    │  (Subject)
                └─────┬───────┘
                      │
         ┌────────────┴────────────┐
         │                         │
   ┌─────▼─────┐            ┌─────▼─────┐
   │ commit     │            │ epics     │
   │ (Jotai)    │            │ (RxJS)    │
   └─────┬─────┘            └─────┬─────┘
         │                         │
      State                   Action(s)
         │                         │
         └──────────────┬──────────┘
                        │
                   actions$.next()
                        │
                ┌───────▼────────┐
                │ notify / event │
                └───────┬────────┘
                        │
                   WebSocket
```

---

## 4. Core Concepts (Strict Definitions)

### 4.1 Action

* Immutable message
* Describes **intent** or **result**
* Never contains logic

```ts
type Action = {
  type: string;
  payload?: unknown;
  meta?: {
    clientId?: string;
    correlationId?: string;
  };
  error?: boolean;
};
```

---

### 4.2 Event

* A **subset of actions**
* Intended to be sent to external systems (clients)
* Usually `notify/*` or `ui/*`

```ts
type NotifyAction =
  | { type: "notify/client"; payload: { clientId: string; message: any } };
```

---

### 4.3 State

* Internal memory
* Used for:

  * workflow progress
  * resync
  * debugging
* **Not broadcast continuously**

---

## 5. Folder Structure (Canonical)

```
src/
  state/
    engine.ts                // createEngine()
    bus.ts                   // actions$, events$
    types.ts                 // Action / Event types

    atoms/
      source.ts              // raw state atoms
      view.ts                // derived read-only atoms
      appState.ts            // optional snapshot

    commands/
      commitRoot.ts          // single write path
      featureA.ts
      featureB.ts

    effects/
      rootEpic.ts
      featureA.epic.ts
      featureB.epic.ts

  server/
    http/
    ws/
```

---

## 6. Rules (Non-negotiable)

### Rule 1 — No direct state mutation

❌ Epic mutating atom
❌ HTTP handler mutating atom

✅ Only **command atoms** may mutate source atoms

---

### Rule 2 — UI / API only dispatches Action

```ts
engine.dispatch(action);
```

No `store.set(sourceAtom)` outside commit layer.

---

### Rule 3 — Epic outputs Action only

* Epic **never**:

  * reads state
  * mutates atoms
* Epic **only returns Action(s)**

---

### Rule 4 — Commit is synchronous & deterministic

* No async in commit atoms
* No side effects in commit atoms

---

## 7. Engine Runtime (Server-side)

### 7.1 Engine Responsibilities

* Own `actions$`
* Run epics
* Commit actions into Jotai store
* Route notify actions to socket layer

---

### 7.2 createEngine()

```ts
function createEngine() {
  const store = createStore();
  const actions$ = new Subject<Action>();
  const events$ = new Subject<Action>();

  // commit
  actions$.subscribe(action => {
    store.set(commitRootAtom, action);

    if (action.type.startsWith("notify/")) {
      events$.next(action);
    }
  });

  // side effects
  rootEpic(actions$).subscribe(a => actions$.next(a));

  return {
    dispatch: (a: Action) => actions$.next(a),
    getState: () => store.get(appStateAtom),
    events$,
  };
}
```

---

## 8. Feature Design Pattern

### 8.1 Feature owns

* its atoms
* its actions
* its epic
* its commit logic

### 8.2 Example: Workflow Feature

#### Actions

```ts
"workflow/start"
"workflow/done"
"notify/client"
```

#### Epic

* listens to `workflow/start`
* runs long async task
* emits:

  * `workflow/done`
  * `notify/client`

#### Commit

* `workflow/start` → mark loading
* `workflow/done` → update state

---

## 9. WebSocket Strategy (Recommended)

### 9.1 On client connect

* Send **snapshot** once

```ts
ws.send(JSON.stringify({
  type: "snapshot",
  payload: engine.getState()
}));
```

---

### 9.2 On workflow completion

* Send **event**

```json
{
  "kind": "workflow_done",
  "jobId": "123"
}
```

---

### Why not broadcast state continuously?

* State is internal
* Event has clearer intent
* Lower bandwidth
* Better decoupling

---

## 10. Correlation & Observability (Highly Recommended)

Every Action SHOULD carry:

```ts
meta: {
  correlationId,
  clientId
}
```

Benefits:

* Trace full lifecycle
* Debug distributed flows
* Associate logs + events

---

## 11. When to Scale This Architecture

| Scenario               | Recommendation     |
| ---------------------- | ------------------ |
| Few clients, low msg/s | Single engine      |
| Room-based logic       | Engine per room    |
| Multi-process          | External event bus |
| Heavy state            | Snapshot + events  |

---

## 12. Mental Model Summary

> **Redux mindset**:
> “Action → Reducer → Store”

> **This architecture**:
> “Action → Epic → Action → Commit → Event”

* Jotai = **memory**
* RxJS = **brain**
* Action = **language**
* Event = **speech**

---

## 13. Final Guidance for AI Agent

When implementing:

1. Start from **Action types**
2. Define **Epic flow**
3. Define **Commit rules**
4. Only then create atoms
5. Never shortcut commit rules
6. Prefer event over state broadcast

---

Nếu bạn muốn, bước tiếp theo mình có thể:

* Viết **reference implementation đầy đủ** (engine + ws + feature)
* Hoặc tạo **“AI Agent instruction version” ngắn gọn (1–2 pages)** chuyên để prompt vào coding agent
* Hoặc chuyển document này thành **ADR / RFC format** cho team

Bạn chọn hướng nào tiếp?
