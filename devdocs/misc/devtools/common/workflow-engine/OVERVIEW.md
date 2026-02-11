# Workflow Engine (`@aweave/workflow-engine`)

> **Source:** `devtools/common/workflow-engine/`
> **Last Updated:** 2026-02-09

Core workflow execution engine — pure TypeScript, zero framework dependencies. Cung cấp `WorkflowEngine` class (EventEmitter-based) chạy multi-step workflows, và xstate v5 machine làm lifecycle bridge giữa engine và Ink dashboard.

## Purpose

- **Reusable engine** — Interpret `WorkflowDefinition`, chạy stages tuần tự, tasks theo strategy (sequential / parallel / race)
- **xstate machine** — Lifecycle management (`idle → running → completed/failed/aborted`), bridge engine events sang xstate context cho UI consumption
- **Type definitions** — Single source of truth cho tất cả workflow types (status, definition, handler, state, events)
- **Utilities** — `sleep()`, `withTimeout()`, `formatDuration()` với AbortSignal support

| Consumer | How it uses |
|----------|------------|
| `@aweave/workflow-dashboard` | Import types (`WorkflowActor`, `WorkflowState`) + machine (`workflowMachine`) |
| `@aweave/cli-plugin-demo-workflow` | Import machine + types để create actor và define workflow |
| Future workflow plugins | Same pattern — import machine, define `WorkflowDefinition`, create actor |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   @aweave/workflow-engine                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  types.ts                        engine.ts                   │
│  ├── WorkflowDefinition          WorkflowEngine extends      │
│  ├── StageDefinition               EventEmitter              │
│  ├── TaskDefinition              ├── run()                   │
│  ├── TaskHandler / TaskContext   ├── abort()                  │
│  ├── TaskOutput / StageResult    ├── resolveHumanInput()      │
│  ├── HumanInputConfig           ├── executeSequential()      │
│  ├── WorkflowState / StageState  ├── executeParallel()       │
│  ├── TaskState / LogEntry        ├── executeRace()           │
│  ├── EngineEvent (union)         └── executeTask() + retry   │
│  └── WorkflowMachineEvent                                    │
│                                                              │
│  machine.ts                      helpers.ts                  │
│  ├── workflowMachine             ├── sleep(ms, signal?)      │
│  │   (setup + createMachine)     ├── withTimeout(promise, ms)│
│  ├── fromCallback bridge         ├── TimeoutError            │
│  │   engine → sendBack → xstate  └── formatDuration(ms)     │
│  │   xstate → receive → engine                               │
│  └── WorkflowActor type                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Layer separation

| Component | Role | Dependencies |
|-----------|------|-------------|
| `WorkflowEngine` | Execution logic — runs stages/tasks, emits events | `node:events`, `node:crypto` only |
| `workflowMachine` | Lifecycle — xstate states, context updates, event bridge | `xstate` |
| Types | Shared interfaces consumed by engine, machine, dashboard, plugins | None |

Engine KHÔNG biết về xstate hay Ink. Machine bridge engine events qua `fromCallback` actor.

## Execution Strategies

| Strategy | Implementation | Behavior |
|----------|---------------|----------|
| `sequential` | `for...of` loop | T1 → T2 → T3. Each task accesses previous results |
| `parallel` | `Promise.allSettled` | All run concurrently. Collects ALL results/failures (not fail-fast) |
| `race` | Custom Promise + `AbortController` | First success wins, rest cancelled via AbortSignal |

### Race cancellation detail

- Separate `raceController` per race stage, linked to parent abort
- Winner resolves → `raceController.abort()` → losers catch abort
- Engine skips `task:failed` emission when `signal.aborted` is true
- Race handler emits `task:cancelled` for non-winners after settlement

### Task retry

- Configurable per-task: `{ maxAttempts, delayMs, backoff: 'fixed' | 'exponential' }`
- Backoff capped by `safeguards.maxRetryDelayMs` (default 30s)
- Cancelled tasks (aborted signal) are NOT retried

### Stage failure handling

`onFailed` callback returns transition: `abort` (default), `skip`, `goto`, `retry`. Protected by safeguards:

- **maxTransitions** (default 50) — global counter, prevents infinite goto/retry loops
- **maxStageRetries** (default 3) — per-stage retry limit
- **Cycle detection** — same goto pair (from→to) counted, aborts when exceeding limit

## Engine Events

Events emitted via `engine.on('event', callback)`, bridged to xstate via `sendBack`:

| Event | Fields | When |
|-------|--------|------|
| `workflow:started` | — | Engine begins |
| `workflow:completed` | — | All stages done |
| `workflow:failed` | `error` | Unrecoverable failure |
| `stage:started` | `stageId`, `stageIndex`, `tasks[]` | Stage begins (includes resolved tasks for dynamic stages) |
| `stage:completed` | `stageId`, `result` | Stage finished successfully |
| `stage:failed` | `stageId`, `error` | Stage failed |
| `stage:skipped` | `stageId` | Condition returned false |
| `task:started` | `stageId`, `taskId` | Task begins (also on retry) |
| `task:completed` | `stageId`, `taskId`, `output` | Task succeeded |
| `task:failed` | `stageId`, `taskId`, `error` | Task failed (NOT emitted if signal aborted) |
| `task:cancelled` | `stageId`, `taskId` | Task cancelled (race loser) |
| `task:log` | `stageId`, `taskId`, `message`, `level` | Handler called `ctx.log()` |
| `task:stream` | `stageId`, `taskId`, `text` | Handler called `ctx.stream()` |
| `task:waiting-for-input` | `stageId`, `taskId`, `config` | Handler called `ctx.waitForInput()` |

## xstate Machine

### States

```
idle ──START──► running ──workflow:completed──► completed (final)
                  │       ──workflow:failed───► failed    (final)
                  │       ──ABORT─────────────► aborted   (final)
                  │
                  │  (all engine events update context here)
                  │  (HUMAN_INPUT forwarded to engine via sendTo)
```

### Design decision: `selectedTask` NOT in xstate

xstate final states (`completed`, `failed`, `aborted`) don't process events. Task navigation must work after workflow ends. Therefore `selectedTask` is React state in the dashboard component, not xstate context.

## Dependencies

| Package | Role |
|---------|------|
| `xstate` (^5) | State machine for lifecycle management |

**devDependencies:** `@types/node`, `typescript`

## Exports

```typescript
// Engine
export { WorkflowEngine } from './engine';

// Machine
export { workflowMachine } from './machine';
export type { WorkflowActor, WorkflowMachineInput } from './machine';

// Helpers
export { sleep, withTimeout, formatDuration, TimeoutError } from './helpers';

// Types (all from types.ts)
export type {
  WorkflowDefinition, StageDefinition, TaskDefinition, TaskHandler, TaskContext,
  TaskOutput, StageResult, StageContext, FailureContext, StageTransition,
  RetryConfig, HumanInputConfig, HumanInputResult,
  WorkflowState, StageState, TaskState, LogEntry,
  EngineEvent, WorkflowMachineEvent, WorkflowSafeguards,
  TaskStatus, StageStatus, WorkflowStatus, ExecutionStrategy, LogLevel,
};
export { HumanInputRequiredError } from './types';
```

## Project Structure

```
devtools/common/workflow-engine/
├── package.json                    # @aweave/workflow-engine (CJS, no "type": "module")
├── tsconfig.json                   # module: commonjs, target: ES2023
├── eslint.config.mjs
└── src/
    ├── index.ts                    # Barrel exports
    ├── types.ts                    # All type definitions + EngineEvent + WorkflowMachineEvent
    ├── engine.ts                   # WorkflowEngine class (EventEmitter)
    ├── machine.ts                  # xstate workflowMachine + fromCallback bridge
    └── helpers.ts                  # sleep, withTimeout, formatDuration, TimeoutError
```

## Development

```bash
cd devtools/common/workflow-engine
pnpm build          # tsc → dist/
pnpm lint:fix       # eslint auto-fix

# Build order: workflow-engine → workflow-dashboard → cli-plugin-*
```

## Related

- **Dashboard:** `devtools/common/workflow-dashboard/` — `devdocs/misc/devtools/common/workflow-dashboard/OVERVIEW.md`
- **Demo Workflow:** `devtools/common/cli-plugin-demo-workflow/` — `devdocs/misc/devtools/common/cli-plugin-demo-workflow/OVERVIEW.md`
- **Design Plan:** `devdocs/misc/devtools/common/plans/260208-workflow-engine.md`
- **Builder Skill:** `devdocs/agent/skills/common/workflow-builder/SKILL.md`
- **Debate Machine (similar pattern):** `devdocs/misc/devtools/common/debate-machine/OVERVIEW.md`
- **Global Overview:** `devdocs/misc/devtools/OVERVIEW.md`
