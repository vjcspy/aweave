# 📋 [WORKFLOW-ENGINE: 2026-02-08] - Workflow Engine Design & Approach

## References

- DevTools overview: `devdocs/misc/devtools/OVERVIEW.md`
- Debate machine (xstate reference): `devdocs/misc/devtools/common/debate-machine/OVERVIEW.md`
- Dashboard plugin (Ink reference): `devdocs/misc/devtools/common/cli-plugin-dashboard/OVERVIEW.md`
- Dashboard Ink plan: `devdocs/misc/devtools/plans/260207-cli-plugin-dashboard-ink.md`
- OpenSearch plugin: `devdocs/misc/devtools/nab/cli-plugin-nab-opensearch/OVERVIEW.md`
- Cursor CLI Headless docs: https://cursor.com/docs/cli/headless
- xstate v5 docs: https://stately.ai/docs/xstate-v5
- Ink v6 docs: https://github.com/vadimdemedes/ink

> **Status:** Brainstorm / Approach — not a detailed implementation plan yet. Captures context, design decisions, and architecture for continuation by any AI agent.

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
- xstate ↔ Ink bridge via `@xstate/react` hooks (`useActor`, `useSelector`)
- Shared components reusable: `Spinner`, `ProgressBar`, `StatusBadge`, `Table`

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
interface WorkflowDefinition<TInput = Record<string, unknown>> {
  id: string;
  name: string;
  description?: string;
  stages: StageDefinition[];
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
   */
  waitForInput: (config: HumanInputConfig) => Promise<HumanInputResult>;
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
  /** Merged outputs from all tasks (parallel/sequential) or winner task (race) */
  data: Record<string, unknown>;
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
1. Engine emits `task:waiting-for-input` event → xstate updates context
2. Ink dashboard renders the prompt and input UI (option list or text input)
3. User responds → xstate sends `HUMAN_INPUT` event with value
4. Engine resolves the `waitForInput` promise → task continues

### Runtime State (What xstate context holds)

```typescript
interface WorkflowState {
  status: WorkflowStatus;
  definition: WorkflowDefinition;
  input: Record<string, unknown>;
  stages: StageState[];
  currentStageIndex: number;
  selectedTaskId: string | null;    // Which task is selected for detail view
  logs: LogEntry[];
  humanInput: HumanInputConfig | null; // Non-null when waiting for input
  startedAt?: number;
  completedAt?: number;
}

interface StageState {
  definition: StageDefinition;
  status: StageStatus;
  tasks: TaskState[];
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
│  • Holds full WorkflowState for UI consumption                       │
│  • User actions: abort, select-task, nav-up/down, human-input        │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 3: Ink Dashboard (React 19 Terminal UI)                        │
│                                                                      │
│  • Subscribes via @xstate/react hooks (useActor, useSelector)        │
│  • Left sidebar: stage/task tree with status icons                   │
│  • Main panel: live logs / task detail / AI streaming / human input  │
│  • Keyboard navigation (↑↓ Enter Esc — no mouse, Ink limitation)    │
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
  const engine = new WorkflowEngine(input.definition, input.input);

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

```typescript
const outputs = await Promise.all(
  tasks.map((task) => this.executeTask(stageId, task, {}))
);
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

### Task execution with retry

```typescript
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    if (signal.aborted) throw new Error('Task cancelled');
    const output = await (timeout ? withTimeout(handler(ctx), timeout) : handler(ctx));
    return output;
  } catch (err) {
    if (signal.aborted) break; // don't retry if cancelled
    if (attempt < maxAttempts) {
      const delay = backoff === 'exponential'
        ? delayMs * 2 ** (attempt - 1)
        : delayMs;
      await sleep(delay);
    }
  }
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
    case 'abort':
      this.emit('event', { type: 'workflow:failed', error: err.message });
      return;
    case 'skip':
      // Continue to next stage
      break;
    case 'goto':
      // Jump to specified stage (adjust loop index)
      currentIndex = this.findStageIndex(transition.stageId);
      break;
    case 'retry':
      // Re-run same stage (optionally only specific tasks)
      currentIndex--; // will be incremented by loop
      break;
  }
}
```

---

## 8. Dynamic Tasks — `prepareTasks`

Some stages don't know their tasks until runtime. Example: "Analyze Source Code" generates one task per detected application from previous stage output.

```typescript
{
  id: 'analyze-source',
  name: 'Analyze Source Code',
  execution: 'parallel',
  prepareTasks: (ctx) => {
    const { grouped } = ctx.stageResults['query-app-logs'].data;
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

  // Called by task handler via ctx.waitForInput()
  private async waitForInput(config: HumanInputConfig): Promise<HumanInputResult> {
    this.emit('event', { type: 'task:waiting-for-input', config });

    return new Promise((resolve) => {
      this.humanInputResolve = (value: string) => {
        this.humanInputResolve = null;
        resolve({ value });
      };
    });
  }

  // Called by xstate via fromCallback receive()
  resolveHumanInput(value: string): void {
    this.humanInputResolve?.(value);
  }
}
```

### Dashboard side

When `state.context.humanInput` is non-null, the main panel renders an input UI:

```tsx
// Option selection mode
{humanInput.options && (
  <SelectInput
    items={humanInput.options}
    onSelect={(item) => send({ type: 'HUMAN_INPUT', value: item.value })}
  />
)}

// Free text mode
{humanInput.freeText && (
  <TextInput
    placeholder={humanInput.defaultValue}
    onSubmit={(value) => send({ type: 'HUMAN_INPUT', value })}
  />
)}
```

### Usage in task handler

```typescript
const analyzeWithConfirmation: TaskHandler = async (ctx) => {
  // ... do analysis ...

  const { value } = await ctx.waitForInput({
    prompt: 'Found 3 potential root causes. Which one to investigate further?',
    options: [
      { label: 'Database timeout in payment-service', value: 'db-timeout' },
      { label: 'Circuit breaker tripped in gateway', value: 'circuit-breaker' },
      { label: 'Memory leak in auth-service', value: 'memory-leak' },
      { label: 'Investigate all of them', value: 'all' },
    ],
  });

  // Continue based on user selection
  if (value === 'all') { /* ... */ }
};
```

---

## 10. Workflow Persistence (Crash Recovery)

Optional — enabled per workflow. Uses xstate v5 `getPersistedSnapshot()`.

```typescript
// Save snapshot to file after each stage completion
actor.subscribe((snapshot) => {
  if (shouldPersist) {
    const persisted = actor.getPersistedSnapshot();
    fs.writeFileSync(
      `.workflow/${definition.id}/checkpoint.json`,
      JSON.stringify(persisted),
    );
  }
});

// Resume from checkpoint
const saved = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
const actor = createActor(workflowMachine, { snapshot: saved });
actor.start();
```

Persistence is stage-level granularity — if workflow crashes mid-stage, it resumes from the beginning of the interrupted stage (not mid-task).

---

## 11. Dashboard Layout

### Ink does NOT support mouse clicks

Ink is keyboard-only terminal UI. Navigation uses:

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate task tree (sidebar) |
| `Enter` | Select task → show detail in main panel |
| `Esc` | Deselect → back to live log/stream view |
| `1-9` | Jump to stage N |
| `q` | Quit |
| `a` | Abort workflow |
| Type | Free text input (when human-in-the-loop active) |

### Visual layout

```
┌─ Root Cause Analysis ──────── RUNNING ─── 00:01:23 ──────────┐
│                                                                │
│ ┌─ Stages ──────────┐ ┌─ Main Panel ─────────────────────────┐│
│ │                    │ │                                      ││
│ │ ✅ Find Time Window│ │  (live logs / task detail / stream)  ││
│ │  ⚡ ✅ 0-10d  1.2s │ │                                      ││
│ │  ⚡ ⊘ 10-20d       │ │  14:32:01 [INFO] Searching index    ││
│ │  ⚡ ⊘ 20-30d       │ │  14:32:03 [INFO] Found 847 entries  ││
│ │  ⚡ ⊘ 30-40d       │ │  14:32:04 [INFO] Grouping by app... ││
│ │  ⚡ ⊘ 40-50d       │ │                                      ││
│ │  ⚡ ⊘ 50-60d       │ │                                      ││
│ │                    │ │                                      ││
│ │ ⠹ Query App Logs   │ │                                      ││
│ │  → ⠹ Query & Group │ │                                      ││
│ │                    │ │                                      ││
│ │ ⬜ Analyze Source   │ │                                      ││
│ │ ⬜ Find Root Cause  │ │                                      ││
│ └────────────────────┘ └──────────────────────────────────────┘│
│                                                                │
│ [↑↓] navigate  [Enter] select  [Esc] live  [a] abort  [q] quit│
└────────────────────────────────────────────────────────────────┘
```

### Status icons

```
⬜  pending       (dimmed)
⠹   running       (animated Spinner, cyan)
✅  success       (green)
❌  failed        (red)
💥  error         (red)
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
| `task-detail` | User selected a completed task | `task.output.detail` or `task.streamBuffer` |
| `human-input` | Task called `waitForInput()` | Prompt + option list or text input |
| `summary` | Workflow completed | Final summary from last stage |

### Dual output mode

Each workflow command supports:
- **Default (interactive):** Ink dashboard with live updates
- **`--format json`:** Non-interactive JSON output for CI/scripting (no Ink loaded)

---

## 12. Package Structure

### Reusable packages (3)

```
devtools/common/
├── workflow-engine/                     # @aweave/workflow-engine (CJS)
│   ├── src/
│   │   ├── index.ts                    # Barrel exports
│   │   ├── types.ts                    # All type definitions from section 5
│   │   ├── engine.ts                   # WorkflowEngine class (EventEmitter-based)
│   │   ├── machine.ts                  # xstate workflowMachine + fromCallback bridge
│   │   └── helpers.ts                  # withTimeout, sleep
│   └── package.json                    # deps: xstate ^5
│
├── workflow-dashboard/                  # @aweave/workflow-dashboard (ESM)
│   ├── src/
│   │   ├── index.ts                    # Export: WorkflowDashboard component
│   │   ├── components/
│   │   │   ├── WorkflowDashboard.tsx   # Root: header + sidebar + main panel + footer
│   │   │   ├── StageTree.tsx           # Left sidebar: stage/task tree
│   │   │   ├── MainPanel.tsx           # Right panel: logs / detail / summary / input
│   │   │   ├── TaskRow.tsx             # Single task row with status icon + duration
│   │   │   ├── HumanInputPanel.tsx     # Option selection or text input UI
│   │   │   └── ElapsedTime.tsx         # Live elapsed timer
│   │   └── hooks/
│   │       └── useNavigation.ts        # ↑↓ keyboard navigation state
│   └── package.json                    # deps: ink ^6, react ^19, @xstate/react
│
├── workflow-shared/                     # @aweave/workflow-shared (CJS)
│   ├── src/
│   │   ├── index.ts                    # Barrel exports
│   │   ├── handlers/
│   │   │   ├── cursor-agent.ts         # callCursorAgent() — exec `agent -p`, parse output
│   │   │   ├── cli-tool.ts             # callCLI() — exec any `aw <command>`, parse MCPResponse
│   │   │   └── file-ops.ts             # readFile, writeFile, ensureDir — common file operations
│   │   └── utils/
│   │       ├── prompt-builder.ts       # Build AI prompts from accumulated context
│   │       └── output-parser.ts        # Parse AI text/JSON/stream-json output
│   └── package.json                    # deps: @aweave/workflow-engine (types only)
```

### Per-workflow packages (1 per workflow)

Each workflow is a **separate oclif plugin** with a **single command**. No `run/list` subcommands.

```
devtools/nab/
├── cli-plugin-rca/                      # @aweave/cli-plugin-nab-rca (ESM)
│   ├── src/
│   │   ├── index.ts                    # Empty (oclif auto-discovers commands)
│   │   ├── commands/
│   │   │   └── rca.ts                  # aw rca --correlationId <id> --env sit
│   │   ├── workflow.ts                 # WorkflowDefinition for Root Cause Analysis
│   │   └── handlers/                   # Domain-specific task handlers
│   │       ├── search-kong.ts          # searchKongIndex() handler
│   │       ├── query-app-logs.ts       # queryApplicationLogs() handler
│   │       ├── analyze-repo.ts         # analyzeRepo() handler (AI)
│   │       └── find-root-cause.ts      # findRootCause() handler (AI)
│   └── package.json
│       # deps: @aweave/workflow-engine, @aweave/workflow-dashboard,
│       #       @aweave/workflow-shared, @oclif/core
```

### Command structure

```bash
# Each workflow = one top-level command
aw rca --correlationId abc123 --env sit            # Root Cause Analysis
aw rca --correlationId abc123 --env sit --format json  # Non-interactive mode

# Future workflows (each a separate cli-plugin-* package):
aw sync-confluence --folder path/to/confluence/     # Confluence sync workflow
aw code-review --branch feature/x                   # Code review workflow
aw migrate-api --source v1 --target v2              # API migration workflow
```

### Dependency flow

```
@aweave/workflow-engine        ← Pure logic, types, xstate machine (CJS)
       ↑
@aweave/workflow-shared        ← Common handlers: callCursorAgent, callCLI (CJS)
       ↑
@aweave/workflow-dashboard     ← Ink UI, reusable by all workflows (ESM)
       ↑
@aweave/cli-plugin-nab-rca    ← oclif plugin: aw rca (ESM)
@aweave/cli-plugin-*          ← other workflow plugins
```

### CJS vs ESM

| Package | Module | Why |
|---------|--------|-----|
| workflow-engine | CJS | Importable by both CJS and ESM consumers |
| workflow-shared | CJS | Same reason — leaf dependency |
| workflow-dashboard | ESM | Ink v6 is ESM-only |
| cli-plugin-* | ESM | Uses Ink (ESM) |

Same pattern as `@aweave/debate-machine` (CJS) consumed by `cli-plugin-debate`.

---

## 13. Concrete Example: Root Cause Analysis

### Input

```bash
aw rca --correlationId "abc-123-def-456" --env sit
```

### Stage flow

```
Stage 1: Find Time Window          [race ⚡]
  ├── Search kong_index  0-10 days   → first hit wins, cancel rest
  ├── Search kong_index 10-20 days
  ├── Search kong_index 20-30 days
  ├── Search kong_index 30-40 days
  ├── Search kong_index 40-50 days
  └── Search kong_index 50-60 days
  Output: { apis[], timestamp, rawResults[] }

  onFailed: ({ error }) => {
    log('Could not find correlationId in any time range');
    return { action: 'abort' };  // or { action: 'goto', stageId: 'not-found' }
  }

Stage 2: Query Application Logs    [sequential →]
  └── Query & Group by application
  Output: { grouped: { [appName]: logEntries[] }, applicationNames[] }

Stage 3: Analyze Source Code        [parallel ∥]
  ├── AI: app-1 (dynamic)           → reads logs + source code → writes analysis.md
  ├── AI: app-2 (dynamic)
  └── AI: app-N (dynamic)
  Output: { [taskId]: { appName, repoUrl, analysis } }

  Tasks generated dynamically via prepareTasks() from Stage 2 output.

Stage 4: Find Root Cause            [sequential →]
  └── AI: Synthesize root cause     → reads all analysis.md → writes root-cause.md
  Output: { rootCause: string }
```

### AI agent context strategy (per stage)

| Stage | AI interaction | Context method |
|-------|---------------|----------------|
| 1 | None (CLI tool only) | — |
| 2 | None (CLI tool only) | — |
| 3 | Cursor CLI per repo | File-based: `.workflow/rca/<app>/logs.json` → AI reads + writes `analysis.md` |
| 4 | Cursor CLI synthesize | File-based: `.workflow/rca/all-analyses.md` → AI reads + writes `root-cause.md` |

---

## 14. Key Design Decisions Summary

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
| 10 | 3 reusable packages + per-workflow plugins | Engine + Dashboard + Shared handlers reused. Each workflow = 1 oclif command |
| 11 | File-based AI context | Write to `.workflow/` dir, AI reads via tool calling. Scales beyond prompt limits |
| 12 | xstate for lifecycle, not execution | xstate manages state + holds data for UI. Engine handles actual task execution |
| 13 | Optional persistence via `getPersistedSnapshot()` | Stage-level checkpointing for crash recovery when needed |
| 14 | Config-based workflow registry | Workflows discovered via oclif plugin system (declared in CLI config) |
| 15 | Dual output: Ink dashboard + `--format json` | Interactive for humans, JSON for CI/scripting/AI agents |
