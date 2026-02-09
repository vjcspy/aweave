# 📋 [WORKFLOW-ENGINE: 2026-02-08] - Workflow Engine Design & Approach

## References

- DevTools overview: `devdocs/misc/devtools/OVERVIEW.md`
- Debate machine (xstate reference): `devdocs/misc/devtools/common/debate-machine/OVERVIEW.md`
- Dashboard plugin (Ink reference): `devdocs/misc/devtools/common/cli-plugin-dashboard/OVERVIEW.md`
- Dashboard Ink plan: `devdocs/misc/devtools/plans/260207-cli-plugin-dashboard-ink.md`
- OpenSearch plugin: TBD — not yet documented, will be added when RCA plugin is implemented
- Cursor CLI Headless docs: https://cursor.com/docs/cli/headless
- xstate v5 docs: https://stately.ai/docs/xstate-v5
- Ink v6 docs: https://github.com/vadimdemedes/ink
- Workflow builder skill: `devdocs/agent/skills/common/workflow-builder/SKILL.md`

> **Status:** Core implemented — engine, dashboard, and demo workflow are built and working. `workflow-shared` deferred until real workflows need it. Persistence/crash recovery designed but not yet implemented.

---

## Implementation Status

### What's implemented (2026-02-09)

| Package | Status | Location |
|---------|--------|----------|
| `@aweave/workflow-engine` | ✅ Implemented (CJS) | `devtools/common/workflow-engine/` |
| `@aweave/workflow-dashboard` | ✅ Implemented (ESM) | `devtools/common/workflow-dashboard/` |
| `@aweave/cli-plugin-demo-workflow` | ✅ Implemented (ESM) | `devtools/common/cli-plugin-demo-workflow/` |
| `@aweave/workflow-shared` | ❌ Deferred | Not created — build when first real workflow needs common handlers |

### Key deviations from original design

| # | Change | Why |
|---|--------|-----|
| 1 | `selectedTask` is React state, not xstate context | xstate final states (`completed`/`failed`/`aborted`) don't process events. Navigation must work after workflow ends. |
| 2 | Removed `SELECT_TASK` and `DESELECT` from machine events | Consequence of #1 — selection is purely UI concern |
| 3 | `humanInput` in xstate context includes `stageId` and `taskId` | Needed to correlate which task is waiting for input |
| 4 | Added `error?: string` to `WorkflowState` | Store workflow-level error message for display |
| 5 | Parallel uses `Promise.allSettled` (not `Promise.all`) | Collects all failures rather than failing fast on first error |
| 6 | Race: cancelled tasks don't emit `task:failed` | Engine skips `task:failed` when `signal.aborted` is true. Only `task:cancelled` is emitted by race handler. Prevents incorrect status display. |
| 7 | Dashboard uses full terminal width | No width cap — better for wide terminals |
| 8 | Task detail view shows status + error + output + stream + logs | Richer than original plan's "detail or streamBuffer" — shows everything |
| 9 | Custom `Spinner.tsx` component (braille chars) | No external `ink-spinner` dependency |
| 10 | Non-interactive JSON mode auto-resolves human input | Uses `setTimeout` to defer `HUMAN_INPUT` send, avoiding re-entrant xstate updates |
| 11 | TTY check with graceful fallback | Falls back to JSON mode when stdin doesn't support raw mode |

### Demo workflow coverage

The `aw demo` command covers all engine features:

| Feature | Stage | Details |
|---------|-------|---------|
| Parallel execution | Validate Environment | 3 concurrent checks |
| Race + cancellation | Run Tests | 3 suites racing, losers cancelled |
| Dynamic tasks (`prepareTasks`) | Code Analysis | 5 modules generated at runtime |
| Stage `reducer` | Code Analysis | Aggregates issues across modules |
| Human-in-the-loop | Review & Approve | Option selection with 4 choices |
| Conditional stage | Deploy, Report | `condition()` checks user decision |
| Retry + exponential backoff | Deploy | Task fails attempt 1, succeeds on retry |
| `onFailed` with `skip` | Notify | Notification failure doesn't block workflow |
| Timeout | Notify | 10s timeout on notification task |
| Streaming output | Multiple | `ctx.stream()` for live progress |
| Logging | All | `ctx.log()` at info/warn/error levels |
| Idempotency keys | Deploy | `ctx.execution.attempt` used in handler |

---

## 1. Problem Statement

### What we want to build

A **reusable workflow engine** that provides a standard definition, standard approach, and standard execution model for building multi-step workflows that interact with CLI tools and AI agents (Cursor CLI headless).

### Key requirements

1. **Standard workflow definition** — declarative config that any new workflow follows
2. **Multi-step orchestration** — stages run sequentially, tasks within stages run with configurable strategies
3. **AI agent interaction** — call Cursor CLI headless (`agent -p`), handle output, manage context between calls
4. **Real-time dashboard** — Ink-based TUI showing workflow progress, logs, AI streaming output
5. **Per-workflow CLI plugin** — each workflow is its own oclif plugin with a dedicated command
6. **Human-in-the-loop** — some stages may pause and wait for user input/selection
7. **Crash recovery** — optional persistence of workflow state for resume

### Concrete motivating example

**Root Cause Analysis workflow** (`aw rca --correlationId abc123`): Given a correlationId, automatically find the time window across kong logs, query application logs, analyze source code with AI agents in parallel, and produce a root cause report.

---

## 2. Technology Decisions

### Why xstate v5 (not Temporal, Inngest, etc.)

| Factor | Temporal/Inngest | xstate v5 |
|--------|-----------------|-----------|
| Infrastructure | Needs server, database | Zero infra — runs in-process |
| Use case | Distributed systems, microservices | Local orchestration, dev tools |
| Durability | ✅ Survive crashes | Optional — via `getPersistedSnapshot()` to file |
| Already in stack | ❌ | ✅ Used in `@aweave/debate-machine` |
| Monorepo fit | Adds complexity | Native — another pnpm workspace package |

**Decision:** xstate v5 for lifecycle + event bridge. Pure TypeScript for execution logic.

### Why Ink v6 for dashboard (not plain console.log)

- Already in stack (`@aweave/cli-plugin-dashboard`)
- React 19 component model = composable, testable
- xstate ↔ Ink bridge via `@xstate/react` hooks (`useSelector`)
- Custom reusable components: `Spinner`, `ElapsedTime`, `TaskRow`, `StageTree`, `HumanInputPanel`

### Cursor CLI Headless — Context model

**Each `agent -p` call is stateless.** No conversation memory between calls.

**This is not a blocker — it's an advantage:**
- xstate machine = the brain. AI agent = the tool.
- Orchestrator controls exactly what context AI receives per task.
- File-based context: write context to files → AI reads via tool calling → larger than prompt stuffing.

**3 strategies for context passing:**

| Strategy | How | When to use |
|----------|-----|-------------|
| **Prompt injection** | Stuff context directly into prompt string | Small context (<4k tokens) |
| **File-based** | Write `.workflow/context.md`, AI reads via tool calling | Most cases (recommended) |
| **Streaming** | `--output-format stream-json` + parse real-time | Dashboard needs live AI progress |

---

## 3. Terminology

```
Workflow                          ← Entire pipeline (e.g., Root Cause Analysis)
  └── Stage                       ← Logical phase (e.g., "Find Time Window")
       ├── execution: strategy    ← How tasks run within this stage
       └── Task[]                 ← Atomic unit of work (e.g., "Search kong 0-10d")
```

| Concept | Description | Example |
|---------|-------------|---------|
| **Workflow** | Full pipeline, stages run sequentially | Root Cause Analysis |
| **Stage** | Logical phase with one execution strategy | "Find Time Window" |
| **Task** | Atomic work unit, one function call | "Search kong_index 0-10 days" |
| **ExecutionStrategy** | How tasks run within a stage | `sequential` / `parallel` / `race` |

**Why not "step"?** "Step" is ambiguous — could mean stage or task. Two-level hierarchy (Stage → Task) is explicit.

---

## 4. Execution Strategies

| Strategy | Behavior | Use case |
|----------|----------|----------|
| `sequential` | T1 → T2 → T3 (one after another) | Steps that depend on each other |
| `parallel` | T1 ∥ T2 ∥ T3 (all must complete) | Independent analyses on different repos |
| `race` | T1 ∥ T2 ∥ T3 (first success wins, cancel rest) | Search different time ranges, take first hit |

### Race cancellation

Uses `AbortController` / `AbortSignal` — native JS cancellation pattern. Task handlers receive `signal` and **MUST** respect it (check `signal.aborted`, pass to fetch/child_process).

**Implementation detail:** When a race task is cancelled by the abort signal, the engine does NOT emit `task:failed`. The race handler emits `task:cancelled` after the winner is determined. This prevents incorrect status display in the dashboard.

---

## 5. Core Types

### Status Types

```typescript
type TaskStatus =
  | 'pending'     // ⬜ Not started
  | 'running'     // ⠹  Currently executing (show Spinner)
  | 'success'     // ✅ Completed successfully
  | 'failed'      // ❌ Completed with logical failure
  | 'error'       // 💥 Unexpected error (crash, timeout)
  | 'cancelled'   // ⊘  Cancelled (another task won the race)
  | 'skipped';    // ⏭  Skipped (stage condition was false)

type StageStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';
type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'aborted';
type ExecutionStrategy = 'sequential' | 'parallel' | 'race';
```

### Workflow Definition (Declarative)

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  stages: StageDefinition[];
  safeguards?: Partial<WorkflowSafeguards>;
}

interface StageDefinition {
  id: string;
  name: string;
  execution: ExecutionStrategy;

  /** Static tasks — known at definition time */
  tasks?: TaskDefinition[];

  /** Dynamic tasks — generated at runtime from previous stage outputs */
  prepareTasks?: (ctx: StageContext) => TaskDefinition[];

  /** Skip this stage if returns false */
  condition?: (ctx: StageContext) => boolean;

  /**
   * Error handler — called when stage fails.
   * Returns a transition action. If not provided, defaults to { action: 'abort' }.
   */
  onFailed?: (ctx: FailureContext) => StageTransition;

  /**
   * Optional reducer to aggregate per-task outputs into a single stage-level value.
   * Result is stored in StageResult.aggregated. If not provided, only per-task results are available.
   */
  reducer?: (taskOutputs: Record<string, TaskOutput>) => unknown;
}

interface FailureContext {
  error: Error;
  stageId: string;
  failedTaskIds: string[];
  stageResults: Record<string, StageResult>;
  input: Record<string, unknown>;
}

type StageTransition =
  | { action: 'abort' }                        // Stop entire workflow
  | { action: 'skip' }                         // Skip to next stage
  | { action: 'goto'; stageId: string }        // Jump to a specific stage
  | { action: 'retry' }                        // Retry this stage from scratch
  | { action: 'retry'; taskIds: string[] };    // Retry only specific failed tasks

interface StageContext {
  input: Record<string, unknown>;
  stageResults: Record<string, StageResult>;
}

interface TaskDefinition {
  id: string;
  name: string;
  handler: TaskHandler;
  retry?: RetryConfig;
  timeout?: number; // ms
}

interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoff?: 'fixed' | 'exponential';
}
```

### Task Handler Interface

```typescript
type TaskHandler = (ctx: TaskContext) => Promise<TaskOutput>;

interface TaskContext {
  /** Original workflow input (e.g., { correlationId: "abc123" }) */
  input: Record<string, unknown>;

  /** Outputs from completed stages, keyed by stage.id */
  stageResults: Record<string, StageResult>;

  /** Outputs from previous tasks in same stage (sequential only) */
  previousTaskResults: Record<string, TaskOutput>;

  /** Cancellation signal — handler MUST respect this for race support */
  signal: AbortSignal;

  /** Emit log entries for dashboard */
  log: (message: string, level?: 'info' | 'warn' | 'error') => void;

  /** Emit streaming text for dashboard main panel (e.g., AI output) */
  stream: (text: string) => void;

  /**
   * Pause and wait for human input.
   * Dashboard renders the prompt/options and resumes when user responds.
   * In non-interactive mode: auto-resolved via defaultValue or first option.
   */
  waitForInput: (config: HumanInputConfig) => Promise<HumanInputResult>;

  /** Idempotency context — handlers SHOULD use these to avoid duplicate side effects on retry/resume */
  execution: {
    /** Unique run ID for this workflow execution */
    runId: string;
    /** Current attempt number (1-based, increments on retry) */
    attempt: number;
    /** Stable key: `${runId}:${stageId}:${taskId}:${attempt}` — use as idempotency key for external calls */
    idempotencyKey: string;
  };
}

interface TaskOutput {
  /** Main data — consumed by downstream tasks/stages */
  data: unknown;
  /** One-line summary for dashboard sidebar */
  summary?: string;
  /** Full detail for dashboard main panel (shown when task is selected) */
  detail?: string;
}

interface StageResult {
  status: StageStatus;
  /** Per-task outputs, keyed by task.id — no implicit merging */
  tasks: Record<string, TaskOutput>;
  /** Optional stage-level aggregation (via stage reducer, if defined) */
  aggregated?: unknown;
}
```

### Human-in-the-Loop

```typescript
interface HumanInputConfig {
  /** Message shown to user */
  prompt: string;

  /** If provided, user selects from these options (rendered as list) */
  options?: Array<{ label: string; value: string }>;

  /** If true, user can type free text (default: false if options provided) */
  freeText?: boolean;

  /** Default value (pre-selected option or pre-filled text) */
  defaultValue?: string;
}

interface HumanInputResult {
  /** Selected option value or typed text */
  value: string;
}
```

When a task calls `ctx.waitForInput(config)`:
1. Engine emits `task:waiting-for-input` event → xstate updates context (sets `humanInput` with stageId + taskId)
2. Ink dashboard renders the prompt and input UI (option list or text input)
3. User responds → xstate sends `HUMAN_INPUT` event with value → forwarded to engine via `sendTo`
4. Engine resolves the `waitForInput` promise → task continues

### Non-Interactive Mode Behavior (`--format json`)

In non-interactive mode, human input is auto-resolved:

1. **Default value** — If `HumanInputConfig.defaultValue` is set, use it
2. **First option** — If options are provided, use `options[0].value`
3. **Empty string** — Fallback

**Important:** The auto-resolution must use `setTimeout` to defer the `HUMAN_INPUT` event send, avoiding re-entrant xstate updates within a `subscribe` callback.

### Runtime State

xstate context holds workflow data for UI consumption:

```typescript
interface WorkflowState {
  status: WorkflowStatus;
  definition: WorkflowDefinition;
  input: Record<string, unknown>;
  stages: StageState[];
  currentStageIndex: number;
  logs: LogEntry[];
  humanInput: (HumanInputConfig & { stageId: string; taskId: string }) | null;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}
```

**Note:** `selectedTask` is NOT in xstate context — it's React state in the dashboard component. This is because xstate final states (completed/failed/aborted) don't process events, and task navigation must work after the workflow ends.

```typescript
interface StageState {
  definition: StageDefinition;
  status: StageStatus;
  tasks: TaskState[];
  result?: StageResult;
  startedAt?: number;
  completedAt?: number;
}

interface TaskState {
  definition: TaskDefinition;
  status: TaskStatus;
  output?: TaskOutput;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  logs: LogEntry[];
  streamBuffer: string;     // Accumulated streaming output
}

interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string; // "stage:<id>" or "task:<id>"
}
```

---

## 6. Architecture — 3 Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 1: WorkflowEngine (Pure TypeScript, no framework deps)         │
│                                                                      │
│  • Interprets WorkflowDefinition                                     │
│  • Runs stages sequentially                                          │
│  • Executes tasks per strategy: sequential / parallel / race         │
│  • AbortController for race cancellation                             │
│  • Emits events via EventEmitter                                     │
│  • Handles onFailed callbacks, retry, timeout                        │
│  • Supports waitForInput (pauses via Promise + external resolve)     │
│  • DOES NOT know about xstate or Ink                                 │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 2: xstate Machine (Lifecycle + Event Bridge)                   │
│                                                                      │
│  • States: idle → running → completed / failed / aborted             │
│  • Invokes engine via fromCallback actor                             │
│  • Engine events → sendBack → xstate context updates                 │
│  • Holds WorkflowState (stages, logs, humanInput) for UI             │
│  • User actions: abort, human-input                                  │
│  • Navigation (select/deselect) is React state, NOT xstate           │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 3: Ink Dashboard (React 19 Terminal UI)                        │
│                                                                      │
│  • Subscribes via @xstate/react useSelector                          │
│  • Left sidebar: stage/task tree with status icons                   │
│  • Main panel: live logs / task detail / AI streaming / human input  │
│  • Keyboard navigation (↑↓ Enter Esc — no mouse, Ink limitation)    │
│  • selectedTask lives in React useState (works after workflow ends)  │
│  • Reusable: any workflow plugin imports this component              │
└──────────────────────────────────────────────────────────────────────┘
```

### Why 3 layers, not 1?

| Layer | Testable? | Dependencies | Reason for separation |
|-------|-----------|-------------|----------------------|
| Engine | ✅ Unit test with mock handlers | node:events only | Core logic independent of UI framework |
| xstate | ✅ Test state transitions | xstate | Lifecycle management separate from execution |
| Ink | ✅ Snapshot test with ink-testing-library | ink, react, @xstate/react | UI concerns isolated |

### xstate ↔ Engine bridge: `fromCallback`

```typescript
const runWorkflowActor = fromCallback(({ sendBack, receive, input }) => {
  const engine = new WorkflowEngine(input.definition, input.workflowInput);

  // ALL engine events bridged to xstate
  engine.on('event', (event) => sendBack(event));

  // Human input: xstate → engine
  receive((event) => {
    if (event.type === 'HUMAN_INPUT') {
      engine.resolveHumanInput(event.value);
    }
  });

  engine.run();
  return () => engine.abort(); // cleanup
});
```

**Why `fromCallback` not `fromPromise`?** `fromPromise` only sends one final result. `fromCallback` can `sendBack` multiple intermediate events — essential for real-time UI updates. It also supports `receive` for bidirectional communication (human input).

---

## 7. Engine Core — Execution Strategies

### Sequential

```typescript
for (const task of tasks) {
  const output = await this.executeTask(stageId, task, previousResults);
  previousResults[task.id] = output;
}
```

### Parallel

Uses `Promise.allSettled` to collect all results/failures (not `Promise.all` which fails fast):

```typescript
const settlements = await Promise.allSettled(
  tasks.map((task) => this.executeTask(stageId, task, {}, signal))
);
// Collect successes, aggregate failures
```

### Race

```typescript
const raceController = new AbortController();

const result = await new Promise((resolve, reject) => {
  let failCount = 0;
  let settled = false;

  tasks.forEach((task) => {
    this.executeTask(stageId, task, {}, raceController.signal)
      .then((output) => {
        if (!settled) {
          settled = true;
          raceController.abort(); // cancel remaining
          resolve({ taskId: task.id, output });
        }
      })
      .catch(() => {
        failCount++;
        if (failCount === tasks.length && !settled) {
          reject(new Error('All race tasks failed'));
        }
      });
  });
});

// Mark non-winner tasks as cancelled
for (const task of tasks) {
  if (task.id !== result.taskId) {
    this.emit('event', { type: 'task:cancelled', stageId, taskId: task.id });
  }
}
```

**Important:** The engine skips `task:failed` emission when `signal.aborted` is true. Only `task:cancelled` is emitted by the race handler. This prevents incorrect status display.

### Task execution with retry

```typescript
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    if (signal.aborted) throw new Error('Task cancelled');
    const output = await (timeout ? withTimeout(handler(ctx), timeout) : handler(ctx));
    return output;
  } catch (err) {
    if (signal.aborted) throw err; // don't retry or emit task:failed if cancelled
    if (attempt < maxAttempts) {
      const delay = backoff === 'exponential'
        ? Math.min(delayMs * 2 ** (attempt - 1), safeguards.maxRetryDelayMs)
        : delayMs;
      await sleep(delay);
    }
  }
}
// Only emit task:failed if not cancelled by signal
if (!signal.aborted) {
  this.emit('event', { type: 'task:failed', stageId, taskId, error });
}
throw lastError;
```

### Stage failure handling (`onFailed` function)

```typescript
try {
  const result = await this.executeStage(stage, tasks);
  this.stageResults[stage.id] = result;
} catch (err) {
  const failureCtx: FailureContext = {
    error: err,
    stageId: stage.id,
    failedTaskIds: this.getFailedTaskIds(stage.id),
    stageResults: this.stageResults,
    input: this.input,
  };

  const transition = stage.onFailed
    ? stage.onFailed(failureCtx)
    : { action: 'abort' as const };

  switch (transition.action) {
    case 'abort':  // Stop entire workflow
    case 'skip':   // Continue to next stage
    case 'goto':   // Jump to specified stage
    case 'retry':  // Re-run same stage
  }
}
```

### Failure-Control Safeguards

```typescript
interface WorkflowSafeguards {
  /** Max total stage transitions (start + goto + retry). Default: 50. */
  maxTransitions: number;
  /** Max retries per individual stage. Default: 3. */
  maxStageRetries: number;
  /** Backoff ceiling for retries (ms). Default: 30000. */
  maxRetryDelayMs: number;
}
```

**Enforced behaviors:**

1. **Global transition counter** — incremented on every stage start (including goto/retry). Emits `workflow:failed` when exceeded.
2. **Per-stage retry counter** — tracks retries per `stageId`. Emits `workflow:failed` when exceeded.
3. **Cycle detection for `goto`** — if the same `goto` transition (from→to pair) fires more than `maxStageRetries` times, abort.
4. **Exponential backoff with cap** — retry delays use `min(delayMs * 2^(attempt-1), maxRetryDelayMs)`.
5. **Terminal errors** — safeguard violations emit `workflow:failed` with typed error and cannot be caught by `onFailed`.

Defaults are configurable per-workflow via `WorkflowDefinition.safeguards`.

### Persistence and Idempotency

> **Not yet implemented.** Design is ready for when crash recovery is needed.

When persistence is enabled, the engine tracks per-task completion:

```typescript
interface TaskCheckpoint {
  taskId: string;
  status: 'success' | 'failed';
  output?: TaskOutput;
  completedAt: number;
}
```

On resume, completed tasks within the interrupted stage are **skipped** (their persisted outputs are restored into `stageResults`). Only incomplete/failed tasks are re-executed.

---

## 8. Dynamic Tasks — `prepareTasks`

Some stages don't know their tasks until runtime. Example: "Analyze Source Code" generates one task per detected application from previous stage output.

```typescript
{
  id: 'analyze-source',
  name: 'Analyze Source Code',
  execution: 'parallel',
  prepareTasks: (ctx) => {
    const { grouped } = ctx.stageResults['query-app-logs'].tasks['query-and-group'].data as any;
    return Object.entries(grouped).map(([appName, logs]) => ({
      id: `analyze-${appName}`,
      name: `AI: ${appName}`,
      handler: analyzeRepo(appName, detectGitRepo(appName)),
      timeout: 5 * 60 * 1000,
    }));
  },
}
```

When a stage has `prepareTasks`, the engine calls it at runtime with accumulated stage results, generates `TaskDefinition[]`, and executes them. The `stage:started` event includes the resolved tasks so the dashboard can render them.

---

## 9. Human-in-the-Loop

### Engine side

```typescript
class WorkflowEngine extends EventEmitter {
  private humanInputResolve: ((value: string) => void) | null = null;

  private async waitForInput(stageId, taskId, config): Promise<HumanInputResult> {
    this.emit('event', { type: 'task:waiting-for-input', stageId, taskId, config });

    return new Promise((resolve) => {
      this.humanInputResolve = (value: string) => {
        this.humanInputResolve = null;
        resolve({ value });
      };
    });
  }

  resolveHumanInput(value: string): void {
    this.humanInputResolve?.(value);
  }
}
```

### Dashboard side

When `state.context.humanInput` is non-null, the main panel renders an `HumanInputPanel` component:

- **Option selection:** Renders options with `↑↓` cursor navigation, `Enter` to confirm
- **Free text:** Renders text input with cursor, `Enter` to submit, `Backspace` to delete

Both modes are built with basic Ink `useInput` — no external dependencies.

### Usage in task handler

```typescript
const analyzeWithConfirmation: TaskHandler = async (ctx) => {
  const { value } = await ctx.waitForInput({
    prompt: 'Found 3 potential root causes. Which one to investigate further?',
    options: [
      { label: 'Database timeout in payment-service', value: 'db-timeout' },
      { label: 'Circuit breaker tripped in gateway', value: 'circuit-breaker' },
      { label: 'Memory leak in auth-service', value: 'memory-leak' },
      { label: 'Investigate all of them', value: 'all' },
    ],
  });

  if (value === 'all') { /* ... */ }
};
```

---

## 10. Workflow Persistence (Crash Recovery)

> **Not yet implemented.** Design is ready.

Optional — enabled per workflow. Uses xstate v5 `getPersistedSnapshot()`.

Persistence is stage-level granularity — if workflow crashes mid-stage, it resumes from the beginning of the interrupted stage (not mid-task).

---

## 11. Dashboard Layout

### Ink does NOT support mouse clicks

Ink is keyboard-only terminal UI. Navigation uses:

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate task tree (sidebar) |
| `Enter` | Select task → show detail in main panel |
| `Esc` | Deselect → back to live log/summary view |
| `1-9` | Jump to stage N |
| `q` | Quit |
| `a` | Abort workflow |
| Type | Free text input (when human-in-the-loop active) |

### Visual layout

Dashboard uses full terminal width.

```
┌─ Demo Pipeline ──────────────── RUNNING ─── 00:01:23 ──────────┐
│                                                                  │
│ ┌─ Stages ──────────┐ │ ┌─ Main Panel ──────────────────────────┐│
│ │                    │ │ │                                        ││
│ │ ✅ Validate Env    │ │ │  (live logs / task detail / stream)    ││
│ │  ∥ ✅ Check Node   │ │ │                                        ││
│ │  ∥ ✅ Check Git    │ │ │  14:32:01 [INFO] Checking Node.js...   ││
│ │  ∥ ✅ Check Disk   │ │ │  14:32:01 [INFO] Node.js v22.20.0     ││
│ │                    │ │ │  14:32:01 [INFO] Branch: feature/demo  ││
│ │ ⠹ Run Tests       │ │ │                                        ││
│ │  ⚡ ⠹ Unit Tests   │ │ │                                        ││
│ │  ⚡ ⠹ Integration  │ │ │                                        ││
│ │  ⚡ ⠹ E2E Tests    │ │ │                                        ││
│ │                    │ │ │                                        ││
│ │ ⬜ Code Analysis   │ │ │                                        ││
│ │ ⬜ Review & Approve│ │ │                                        ││
│ │ ⬜ Deploy          │ │ │                                        ││
│ └────────────────────┘ │ └────────────────────────────────────────┘│
│                                                                  │
│ [↑↓] navigate [Enter] select [Esc] back [1-9] jump [a] abort [q]│
└──────────────────────────────────────────────────────────────────┘
```

### Status icons

```
⬜  pending       (dimmed)
⠹   running       (animated Spinner, cyan — custom braille component)
✅  success       (green)
❌  failed        (red)
⊘   cancelled     (dimmed)
⏭   skipped       (dimmed)
```

### Strategy icons (shown before tasks in sidebar)

```
→   sequential
∥   parallel
⚡  race
```

### Main panel modes

| Mode | When | Content |
|------|------|---------|
| `live` | Default, no task selected | Rolling log entries + streaming AI output from active task |
| `task-detail` | User selected a task | Status, error, output.detail, streamBuffer, task logs |
| `human-input` | Task called `waitForInput()` | Prompt + option list or text input |
| `summary` | Workflow completed | Stage list with status and duration |

### Dual output mode

Each workflow command supports:
- **Default (interactive):** Ink dashboard with live updates (requires TTY with raw mode)
- **`--format json`:** Non-interactive JSON output for CI/scripting (no Ink loaded, auto-resolves human input)
- **Auto-fallback:** If stdin doesn't support raw mode, automatically falls back to JSON mode

---

## 12. Package Structure

### Reusable packages (2 implemented + 1 deferred)

```
devtools/common/
├── workflow-engine/                     # @aweave/workflow-engine (CJS) ✅
│   ├── src/
│   │   ├── index.ts                    # Barrel exports
│   │   ├── types.ts                    # All type definitions
│   │   ├── engine.ts                   # WorkflowEngine class (EventEmitter-based)
│   │   ├── machine.ts                  # xstate workflowMachine + fromCallback bridge
│   │   └── helpers.ts                  # withTimeout, sleep, formatDuration
│   └── package.json                    # deps: xstate ^5
│
├── workflow-dashboard/                  # @aweave/workflow-dashboard (ESM) ✅
│   ├── src/
│   │   ├── index.ts                    # Export: WorkflowDashboard + all components
│   │   ├── components/
│   │   │   ├── WorkflowDashboard.tsx   # Root: header + sidebar + main panel + footer
│   │   │   ├── StageTree.tsx           # Left sidebar: stage/task tree + buildNavItems()
│   │   │   ├── MainPanel.tsx           # Right panel: logs / detail / summary / input
│   │   │   ├── TaskRow.tsx             # Single task row with status icon + duration
│   │   │   ├── HumanInputPanel.tsx     # Option selection or text input UI
│   │   │   ├── ElapsedTime.tsx         # Live elapsed timer
│   │   │   └── Spinner.tsx             # Animated braille spinner
│   │   └── hooks/
│   │       └── useNavigation.ts        # ↑↓ keyboard navigation state
│   └── package.json                    # deps: ink ^6, react ^19, @xstate/react ^4
│
├── workflow-shared/                     # @aweave/workflow-shared (CJS) ❌ DEFERRED
│   └── (not yet created — build when first real workflow needs common handlers)
```

### Demo workflow (case study)

```
devtools/common/
├── cli-plugin-demo-workflow/            # @aweave/cli-plugin-demo-workflow (ESM) ✅
│   ├── src/
│   │   ├── index.ts                    # Empty (oclif auto-discovers commands)
│   │   ├── commands/
│   │   │   └── demo.ts                # aw demo [--format interactive|json]
│   │   └── workflow.ts                 # WorkflowDefinition with all features
│   └── package.json
```

### Per-workflow packages (1 per workflow)

Each workflow is a **separate oclif plugin** with a **single command**. No `run/list` subcommands.

### Dependency flow

```
@aweave/workflow-engine        ← Pure logic, types, xstate machine (CJS)
       ↑
@aweave/workflow-dashboard     ← Ink UI, reusable by all workflows (ESM)
       ↑
@aweave/cli-plugin-*          ← oclif plugins: one per workflow (ESM)
```

### CJS vs ESM

| Package | Module | Why |
|---------|--------|-----|
| workflow-engine | CJS | Importable by both CJS and ESM consumers |
| workflow-dashboard | ESM | Ink v6 is ESM-only |
| cli-plugin-* | ESM | Uses Ink (ESM) |

Same pattern as `@aweave/debate-machine` (CJS) consumed by `cli-plugin-debate`.

---

## 13. Key Design Decisions Summary

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | 2-level hierarchy: Stage → Task | Covers all patterns. Mixed strategies → split into multiple stages |
| 2 | `prepareTasks()` for dynamic tasks | Runtime task generation. Cleaner than nested state machines |
| 3 | Engine separated from xstate | Testable independently. Engine emits events, xstate consumes |
| 4 | `fromCallback` bridge (not `fromPromise`) | Supports streaming intermediate events + bidirectional (human input) |
| 5 | `AbortController` for race cancellation | Native JS pattern. Handlers receive `signal` and must respect it |
| 6 | `ctx.stream(text)` in TaskContext | AI agent streaming output feeds directly to dashboard main panel |
| 7 | `ctx.waitForInput()` for human-in-the-loop | Pauses task, dashboard renders input UI, resumes on response |
| 8 | `onFailed` is a function returning transition | Full control: abort, skip, goto, retry — with access to error context |
| 9 | Keyboard navigation (not mouse) | Ink does not support mouse clicks. Arrow keys + Enter = standard TUI |
| 10 | 2 reusable packages + per-workflow plugins | Engine + Dashboard reused. Each workflow = 1 oclif command |
| 11 | File-based AI context | Write to `.workflow/` dir, AI reads via tool calling. Scales beyond prompt limits |
| 12 | xstate for lifecycle, not execution | xstate manages state + holds data for UI. Engine handles actual task execution |
| 13 | Optional persistence via `getPersistedSnapshot()` | Stage-level checkpointing for crash recovery when needed |
| 14 | Config-based workflow registry | Workflows discovered via oclif plugin system (declared in CLI config) |
| 15 | Dual output: Ink dashboard + `--format json` | Interactive for humans, JSON for CI/scripting/AI agents |
| 16 | `selectedTask` in React state, not xstate | xstate final states don't process events. Navigation must work after workflow ends. |
| 17 | Per-task outputs keyed by taskId (no implicit merge) | Explicit data lineage; optional `reducer` for aggregation |
| 18 | Failure-control safeguards (maxTransitions, cycle detection) | Prevents infinite loops and cost runaway from goto/retry |
| 19 | Idempotency key in TaskContext (`runId:stageId:taskId:attempt`) | Handlers can deduplicate side effects on retry/resume |
| 20 | Race losers: skip `task:failed`, only emit `task:cancelled` | Prevents incorrect status display. Engine checks `signal.aborted` before emitting failure. |
| 21 | Non-interactive auto-resolve via `setTimeout` | Avoids re-entrant xstate updates within `subscribe` callback |
| 22 | TTY check with JSON fallback | Graceful degradation when raw mode unavailable (IDE terminals, CI) |
| 23 | `Promise.allSettled` for parallel (not `Promise.all`) | Collects all task results/failures rather than failing fast on first error |
