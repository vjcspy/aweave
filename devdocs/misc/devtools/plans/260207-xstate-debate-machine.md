# 📋 [XSTATE-MACHINE: 2026-02-07] - Extract Debate State Machine to Shared xstate Package

## References

- Debate spec: `devdocs/misc/devtools/plans/debate.md`
- Unified NestJS server plan: `devdocs/misc/devtools/plans/260207-unified-nestjs-server.md`
- CLI oclif refactor plan: `devdocs/misc/devtools/plans/260207-cli-oclif-refactor.md`
- CLI plugin debate OVERVIEW: `devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md`
- Current state machine: `devtools/common/nestjs-debate/src/state-machine.ts`
- Current types: `devtools/common/nestjs-debate/src/types.ts`
- CLI plugin debate: `devtools/common/cli-plugin-debate/`
- NestJS debate module: `devtools/common/nestjs-debate/`
- pnpm workspace: `devtools/pnpm-workspace.yaml`

## User Requirements

1. Move state machine from `nestjs-debate` (server) to `cli-plugin-debate` (CLI) — CLI is the primary owner
2. Use **xstate** library for state machine definition
3. Current state must sync to database via NestJS server
4. Create shared package `@aweave/debate-machine` for the xstate definition
5. Server still validates transitions (because `debate-web` bypasses CLI)

## 🎯 Objective

Extract the debate state machine into a shared package `@aweave/debate-machine` using **xstate v5**. The CLI plugin becomes the primary state machine consumer (pre-validation, available actions guidance for AI agents). The NestJS server imports the same machine for final validation before persisting state to the database.

### ⚠️ Key Considerations

1. **Single definition, two consumers** — The xstate machine is defined once in `@aweave/debate-machine`. Both `cli-plugin-debate` and `nestjs-debate` import it. No duplicated logic.

2. **Server MUST still validate** — `debate-web` (Arbitrator) submits INTERVENTION/RULING directly to the server via WebSocket, bypassing CLI entirely. Server uses the same xstate machine to validate these transitions. Additionally, race conditions between concurrent CLI instances (Proposer + Opponent) require server-side validation as the final gatekeeper.

3. **CommonJS compatibility** — `cli-plugin-debate` uses `"module": "commonjs"` (oclif requirement). xstate v5 ships CJS builds (`dist/cjs/index.cjs`), so this works. The shared package must also use CommonJS.

4. **No extra HTTP calls for pre-validation** — CLI commands that write (submit, appeal, etc.) do NOT make an extra `get-context` call just to pre-validate. Instead:
   - `get-context` enriches its response with `available_actions` (computed via xstate)
   - Write commands send directly to server; server validates
   - This avoids doubling HTTP calls per action

5. **State machine does NOT handle `create` (MOTION)** — Creating a debate is initialization, not a state transition. The xstate machine starts in `AWAITING_OPPONENT`. The `create` command skips state machine validation entirely (there's no prior state to validate against).

6. **Types split** — Core types (`DebateState`, `ArgumentType`, `Role`) move to `@aweave/debate-machine`. API-specific types (`WaiterRole`, `WaitAction`, `SuccessResponse`, `ErrorResponse`) stay in `@aweave/nestjs-debate` and import core types from the shared package.

## 📐 Spec / Decisions

### 1. xstate Machine Definition

```typescript
// debate-machine/src/machine.ts
import { setup } from 'xstate';
import type { DebateEvent } from './types';

export const debateMachine = setup({
  types: {
    events: {} as DebateEvent,
  },
  guards: {
    isOpponent: ({ event }) => 'role' in event && event.role === 'opponent',
    isProposer: ({ event }) => 'role' in event && event.role === 'proposer',
    isCloseRuling: ({ event }) =>
      event.type === 'SUBMIT_RULING' && event.close === true,
  },
}).createMachine({
  id: 'debate',
  initial: 'AWAITING_OPPONENT',
  states: {
    AWAITING_OPPONENT: {
      on: {
        SUBMIT_CLAIM: { target: 'AWAITING_PROPOSER', guard: 'isOpponent' },
        SUBMIT_INTERVENTION: 'INTERVENTION_PENDING',
      },
    },
    AWAITING_PROPOSER: {
      on: {
        SUBMIT_CLAIM: { target: 'AWAITING_OPPONENT', guard: 'isProposer' },
        SUBMIT_APPEAL: 'AWAITING_ARBITRATOR',
        SUBMIT_INTERVENTION: 'INTERVENTION_PENDING',
        SUBMIT_RESOLUTION: 'AWAITING_ARBITRATOR',
      },
    },
    AWAITING_ARBITRATOR: {
      on: {
        SUBMIT_RULING: [
          { target: 'CLOSED', guard: 'isCloseRuling' },
          { target: 'AWAITING_PROPOSER' },
        ],
      },
    },
    INTERVENTION_PENDING: {
      on: {
        SUBMIT_RULING: [
          { target: 'CLOSED', guard: 'isCloseRuling' },
          { target: 'AWAITING_PROPOSER' },
        ],
      },
    },
    CLOSED: { type: 'final' },
  },
});
```

### 2. Shared Types

```typescript
// debate-machine/src/types.ts

export type DebateState =
  | 'AWAITING_OPPONENT'
  | 'AWAITING_PROPOSER'
  | 'AWAITING_ARBITRATOR'
  | 'INTERVENTION_PENDING'
  | 'CLOSED';

export type ArgumentType =
  | 'MOTION'
  | 'CLAIM'
  | 'APPEAL'
  | 'RULING'
  | 'INTERVENTION'
  | 'RESOLUTION';

export type Role = 'proposer' | 'opponent' | 'arbitrator';

export type DebateEvent =
  | { type: 'SUBMIT_CLAIM'; role: 'proposer' | 'opponent' }
  | { type: 'SUBMIT_APPEAL'; role: 'proposer' }
  | { type: 'SUBMIT_RESOLUTION'; role: 'proposer' }
  | { type: 'SUBMIT_INTERVENTION'; role: 'arbitrator' }
  | { type: 'SUBMIT_RULING'; role: 'arbitrator'; close?: boolean };
```

### 3. Utility Functions

```typescript
// debate-machine/src/utils.ts
import { createActor } from 'xstate';
import { debateMachine } from './machine';
import type { DebateState, DebateEvent, Role } from './types';

/**
 * Check if a transition is valid from current state.
 * Used by: CLI (pre-validate), Server (final validate).
 */
export function canTransition(
  currentState: DebateState,
  event: DebateEvent,
): boolean {
  const snapshot = debateMachine.resolveState({ value: currentState });
  const actor = createActor(debateMachine, { snapshot });
  actor.start();
  const result = actor.getSnapshot().can(event);
  actor.stop();
  return result;
}

/**
 * Calculate next state after transition.
 * Returns null if transition is not allowed.
 * Used by: Server (calculate + persist new state).
 */
export function transition(
  currentState: DebateState,
  event: DebateEvent,
): DebateState | null {
  const snapshot = debateMachine.resolveState({ value: currentState });
  const actor = createActor(debateMachine, { snapshot });
  actor.start();
  if (!actor.getSnapshot().can(event)) {
    actor.stop();
    return null;
  }
  actor.send(event);
  const next = actor.getSnapshot().value as DebateState;
  actor.stop();
  return next;
}

/**
 * Get all valid actions for a given state + role combination.
 * Used by: CLI get-context to tell AI agent what it can do next.
 */
export function getAvailableActions(
  currentState: DebateState,
  role: Role,
): string[] {
  const allEvents: DebateEvent[] = [
    { type: 'SUBMIT_CLAIM', role: role as any },
    { type: 'SUBMIT_APPEAL', role: 'proposer' },
    { type: 'SUBMIT_RESOLUTION', role: 'proposer' },
    { type: 'SUBMIT_INTERVENTION', role: 'arbitrator' },
    { type: 'SUBMIT_RULING', role: 'arbitrator' },
    { type: 'SUBMIT_RULING', role: 'arbitrator', close: true },
  ];

  return allEvents
    .filter((event) => {
      // Only check events that match the queried role
      if ('role' in event && event.role !== role) return false;
      return canTransition(currentState, event);
    })
    .map((event) =>
      event.type === 'SUBMIT_RULING' && event.close
        ? 'SUBMIT_RULING_CLOSE'
        : event.type,
    );
}

/**
 * Map ArgumentType + Role to DebateEvent.
 * Bridge between database model (argument type/role) and xstate events.
 * Used by: Server when processing submissions.
 */
export function toDebateEvent(
  argType: ArgumentType,
  role: Role,
  options?: { close?: boolean },
): DebateEvent | null {
  switch (argType) {
    case 'CLAIM':
      if (role === 'proposer' || role === 'opponent')
        return { type: 'SUBMIT_CLAIM', role };
      return null;
    case 'APPEAL':
      if (role === 'proposer') return { type: 'SUBMIT_APPEAL', role };
      return null;
    case 'RESOLUTION':
      if (role === 'proposer') return { type: 'SUBMIT_RESOLUTION', role };
      return null;
    case 'INTERVENTION':
      if (role === 'arbitrator') return { type: 'SUBMIT_INTERVENTION', role };
      return null;
    case 'RULING':
      if (role === 'arbitrator')
        return { type: 'SUBMIT_RULING', role, close: options?.close };
      return null;
    default:
      return null; // MOTION is initialization, not a transition
  }
}
```

### 4. Mapping: Old Functions → New Functions

| Old (`nestjs-debate/src/state-machine.ts`) | New (`@aweave/debate-machine`) | Notes |
|---|---|---|
| `isActionAllowed(state, role, action)` | `canTransition(state, event)` | Event-based instead of string-based action |
| `calculateNextState(state, argType, role, opts)` | `transition(state, event)` | Returns `null` instead of same state on failure |
| `getAllowedActions(state, role)` | `getAvailableActions(state, role)` | Returns event type names |
| — (new) | `toDebateEvent(argType, role, opts)` | Bridge between DB model and xstate events |

### 5. Server-side Changes

`nestjs-debate/src/argument.service.ts` currently does:

```typescript
// OLD
import { isActionAllowed, calculateNextState } from './state-machine';

// Validate
if (!isActionAllowed(debate.state as DebateState, input.role, input.action_name as any)) {
  throw toActionNotAllowedError(debate.state, input.role, input.action_name);
}

// Transition
const nextState = calculateNextState(debate.state as DebateState, input.type, input.role, { close: input.close });
```

After migration:

```typescript
// NEW
import { toDebateEvent, transition } from '@aweave/debate-machine';

// Convert to xstate event
const event = toDebateEvent(input.type as ArgumentType, input.role as Role, { close: input.close });
if (!event) throw new InvalidInputError(`Invalid argument type/role: ${input.type}/${input.role}`);

// Validate + transition in one step
const nextState = transition(debate.state as DebateState, event);
if (!nextState) throw toActionNotAllowedError(debate.state, input.role, input.action_name);
```

### 6. CLI-side Changes

#### 6.1 `get-context` enrichment

`cli-plugin-debate/src/commands/debate/get-context.ts` currently returns server response as-is. After migration, it enriches the response:

```typescript
// NEW in get-context.ts
import { getAvailableActions } from '@aweave/debate-machine';
import type { DebateState, Role } from '@aweave/debate-machine';

// After receiving server response:
const debate = data.debate as Record<string, unknown>;
const state = debate.state as DebateState;

// Enrich with available actions for each role
const enriched = {
  ...data,
  available_actions: {
    proposer: getAvailableActions(state, 'proposer'),
    opponent: getAvailableActions(state, 'opponent'),
    arbitrator: getAvailableActions(state, 'arbitrator'),
  },
};
```

**Example output for AI agent:**

```json
{
  "debate": { "id": "...", "state": "AWAITING_PROPOSER", ... },
  "arguments": [...],
  "available_actions": {
    "proposer": ["SUBMIT_CLAIM", "SUBMIT_APPEAL", "SUBMIT_RESOLUTION"],
    "opponent": [],
    "arbitrator": ["SUBMIT_INTERVENTION"]
  }
}
```

AI agent can immediately see what actions are available without guessing.

#### 6.2 `wait` response enrichment

`cli-plugin-debate/src/commands/debate/wait.ts` — when a new argument arrives, include available actions for the waiting role:

```typescript
// After receiving new argument in poll response:
import { getAvailableActions } from '@aweave/debate-machine';

const debateState = data.debate_state as DebateState;
const enriched = {
  status: 'new_argument',
  action: data.action,
  debate_state: debateState,
  argument: data.argument,
  next_argument_id_to_wait: argument.id,
  available_actions: getAvailableActions(debateState, flags.role as Role),
};
```

#### 6.3 Write commands — NO pre-validation

Write commands (`submit`, `appeal`, `request-completion`) do **NOT** pre-validate via xstate. Rationale:
- Would require extra `get-context` HTTP call to get current state (CLI commands are stateless — each invocation is a fresh process)
- Server validates in < 1ms (same xstate check + DB transaction)
- Server error messages are already structured (`ActionNotAllowedError` with `code`, `suggestion`)
- Net effect: doubling HTTP calls for marginal UX benefit

If future requirements demand CLI-side validation (e.g., offline mode), the infrastructure is ready — just import from `@aweave/debate-machine`.

## 🔄 Implementation Plan

### Phase 1: Create `@aweave/debate-machine` Package ✅ DONE

- [x] Create directory `devtools/common/debate-machine/`
- [x] Create `devtools/common/debate-machine/package.json`
  - **Outcome**: Package installable via pnpm workspace
- [x] Create `devtools/common/debate-machine/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "module": "commonjs",
      "declaration": true,
      "removeComments": true,
      "target": "ES2023",
      "sourceMap": true,
      "outDir": "./dist",
      "rootDir": "./src",
      "incremental": true,
      "skipLibCheck": true,
      "strict": true,
      "forceConsistentCasingInFileNames": true,
      "esModuleInterop": true,
      "resolveJsonModule": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist"]
  }
  ```
  - CommonJS to match both consumers (oclif CLI + NestJS)
- [x] Create `devtools/common/debate-machine/src/types.ts` — core types (see Spec section 2)
  - Move `DebateState`, `ArgumentType`, `Role` from `nestjs-debate/src/types.ts`
  - Add new `DebateEvent` union type for xstate events
  - **Outcome**: Single source of truth for debate domain types
- [x] Create `devtools/common/debate-machine/src/machine.ts` — xstate machine (see Spec section 1)
  - 5 states: `AWAITING_OPPONENT`, `AWAITING_PROPOSER`, `AWAITING_ARBITRATOR`, `INTERVENTION_PENDING`, `CLOSED`
  - 5 event types: `SUBMIT_CLAIM`, `SUBMIT_APPEAL`, `SUBMIT_RESOLUTION`, `SUBMIT_INTERVENTION`, `SUBMIT_RULING`
  - 3 guards: `isOpponent`, `isProposer`, `isCloseRuling`
  - **Outcome**: Declarative state machine matching current transition table from `devdocs/misc/devtools/plans/debate.md` section 2.1.2
- [x] Create `devtools/common/debate-machine/src/utils.ts` — utility functions (see Spec section 3)
  - `canTransition()` — check if event is valid from state
  - `transition()` — calculate next state (returns null if invalid)
  - `getAvailableActions()` — list valid actions for state + role
  - `toDebateEvent()` — bridge ArgumentType/Role → xstate DebateEvent
  - **Outcome**: Clean API for both CLI and server consumers
- [x] Create `devtools/common/debate-machine/src/index.ts` — barrel export:
  ```typescript
  export { debateMachine } from './machine';
  export { canTransition, transition, getAvailableActions, toDebateEvent } from './utils';
  export type { DebateState, ArgumentType, Role, DebateEvent } from './types';
  ```
- [x] Update `devtools/pnpm-workspace.yaml` — add `common/debate-machine`
- [x] Run `cd devtools && pnpm install` to link workspace package
- [x] Run `cd devtools/common/debate-machine && pnpm build` to verify compilation
  - **Outcome**: `@aweave/debate-machine` builds successfully, exports all functions and types

### Phase 2: Update `@aweave/nestjs-debate` to Use Shared Machine ✅ DONE

- [x] Add dependency `@aweave/debate-machine: workspace:*` in `nestjs-debate/package.json`
- [x] Update `nestjs-debate/src/types.ts` — remove core types, re-export from `@aweave/debate-machine`
- [x] Update `nestjs-debate/src/argument.service.ts` — replace `isActionAllowed`/`calculateNextState` with `toDebateEvent`/`canTransition`/`transition`
- [x] Update `nestjs-debate/src/debate.service.ts` — remove unused `state-machine` import
- [x] Delete `nestjs-debate/src/state-machine.ts`
- [x] Verify no other files import from `./state-machine`
- [x] `pnpm build` succeeds

### Phase 3: Update `@aweave/cli-plugin-debate` to Use Shared Machine ✅ DONE

- [x] Add dependency `@aweave/debate-machine: workspace:*` in `cli-plugin-debate/package.json`
- [x] Update `get-context.ts` — enrich response with `available_actions` for all 3 roles
- [x] Update `wait.ts` — include `available_actions` for waiting role when new argument arrives
- [x] `pnpm build` succeeds

### Phase 4: Verify Build Chain & Test ✅ DONE

- [x] Full workspace rebuild: `cd devtools && pnpm -r build` — all 9 packages build successfully
- [x] Verify xstate machine: 52/52 transition tests passed (transition table, canTransition, getAvailableActions, toDebateEvent, full flow simulation)
- [x] CLI commands: `aw debate generate-id`, `aw debate get-context --help`, `aw debate wait --help` all work
- [x] No linter errors on modified files

### Phase 5: Update Documentation ✅ DONE

- [x] Update `devdocs/misc/devtools/common/cli-plugin-debate/OVERVIEW.md` — added debate-machine dep, updated approach section
- [x] Update `devdocs/misc/devtools/plans/debate.md` — updated data flow and components sections
- [x] Create `devdocs/misc/devtools/common/debate-machine/OVERVIEW.md` — full package documentation

## 📊 Summary of Results

### ✅ Completed Achievements

- [x] Created `@aweave/debate-machine` package with xstate v5 machine definition (5 states, 5 events, 3 guards)
- [x] 4 utility functions: `canTransition`, `transition`, `getAvailableActions`, `toDebateEvent`
- [x] `@aweave/nestjs-debate` now imports shared machine — old `state-machine.ts` deleted
- [x] `@aweave/cli-plugin-debate` enriches `get-context` and `wait` responses with `available_actions`
- [x] Full workspace builds (9 packages), 52/52 transition tests pass
- [x] All documentation updated (3 docs: cli-plugin-debate OVERVIEW, debate.md, new debate-machine OVERVIEW)

## 🚧 Outstanding Issues & Follow-up

### ⚠️ Issues/Clarifications

- [x] **xstate v5 `resolveState` + `can()` API** — Verified working. `debateMachine.resolveState({ value: stateString })` correctly restores state, `actor.getSnapshot().can(event)` validates transitions. All 52 tests pass.

- [x] **xstate v5 CJS compatibility** — Verified working. `require('xstate')` resolves correctly in CommonJS context. Build succeeds for both oclif CLI (CommonJS) and NestJS (CommonJS).

- [x] **Turbo build dependency** — pnpm workspace topology handles this via `workspace:*` dependency declarations. `pnpm -r build` builds `debate-machine` before its consumers.

- [ ] **Future: CLI-side pre-validation** — Current implementation skips pre-validation in write commands (to avoid extra HTTP calls). If needed later, `@aweave/debate-machine` provides all the infrastructure. Write commands would need to either: (a) accept `--current-state` flag from AI agent, or (b) fetch state internally before validating.

- [ ] **Future: xstate Stately Studio visualization** — xstate machines can be visualized at https://stately.ai/viz. The `debateMachine` can be exported and pasted there for visual debugging.
