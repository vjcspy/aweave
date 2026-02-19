/**
 * Core type definitions for the workflow engine.
 *
 * Hierarchy: Workflow → Stage → Task
 * - Stages run sequentially
 * - Tasks within a stage run per execution strategy (sequential | parallel | race)
 */

// ---------------------------------------------------------------------------
// Status types
// ---------------------------------------------------------------------------

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'error'
  | 'cancelled'
  | 'skipped';

export type StageStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped';

export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted';

export type ExecutionStrategy = 'sequential' | 'parallel' | 'race';

export type LogLevel = 'info' | 'warn' | 'error';

// ---------------------------------------------------------------------------
// Workflow definition (declarative)
// ---------------------------------------------------------------------------

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  stages: StageDefinition[];
  safeguards?: Partial<WorkflowSafeguards>;
}

export interface StageDefinition {
  id: string;
  name: string;
  execution: ExecutionStrategy;

  /** Static tasks — known at definition time */
  tasks?: TaskDefinition[];

  /** Dynamic tasks — generated at runtime from previous stage outputs */
  prepareTasks?: (ctx: StageContext) => TaskDefinition[];

  /** Skip this stage if returns false */
  condition?: (ctx: StageContext) => boolean;

  /** Error handler — returns a transition action. Default: { action: 'abort' } */
  onFailed?: (ctx: FailureContext) => StageTransition;

  /** Aggregate per-task outputs into a single stage-level value */
  reducer?: (taskOutputs: Record<string, TaskOutput>) => unknown;
}

export interface StageContext {
  input: Record<string, unknown>;
  stageResults: Record<string, StageResult>;
}

export interface FailureContext {
  error: Error;
  stageId: string;
  failedTaskIds: string[];
  stageResults: Record<string, StageResult>;
  input: Record<string, unknown>;
}

export type StageTransition =
  | { action: 'abort' }
  | { action: 'skip' }
  | { action: 'goto'; stageId: string }
  | { action: 'retry' }
  | { action: 'retry'; taskIds: string[] };

export interface TaskDefinition {
  id: string;
  name: string;
  handler: TaskHandler;
  retry?: RetryConfig;
  timeout?: number; // ms
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoff?: 'fixed' | 'exponential';
}

// ---------------------------------------------------------------------------
// Task handler interface
// ---------------------------------------------------------------------------

export type TaskHandler = (ctx: TaskContext) => Promise<TaskOutput>;

export interface TaskContext {
  /** Original workflow input */
  input: Record<string, unknown>;

  /** Outputs from completed stages, keyed by stage.id */
  stageResults: Record<string, StageResult>;

  /** Outputs from previous tasks in same stage (sequential only) */
  previousTaskResults: Record<string, TaskOutput>;

  /** Cancellation signal — handler MUST respect this for race support */
  signal: AbortSignal;

  /** Emit log entries for dashboard */
  log: (message: string, level?: LogLevel) => void;

  /** Emit streaming text for dashboard main panel */
  stream: (text: string) => void;

  /** Pause and wait for human input */
  waitForInput: (config: HumanInputConfig) => Promise<HumanInputResult>;

  /** Idempotency context */
  execution: {
    runId: string;
    attempt: number;
    idempotencyKey: string;
  };
}

export interface TaskOutput {
  /** Main data — consumed by downstream tasks/stages */
  data: unknown;
  /** One-line summary for dashboard sidebar */
  summary?: string;
  /** Full detail for dashboard main panel */
  detail?: string;
}

export interface StageResult {
  status: StageStatus;
  /** Per-task outputs, keyed by task.id */
  tasks: Record<string, TaskOutput>;
  /** Optional stage-level aggregation (via reducer) */
  aggregated?: unknown;
}

// ---------------------------------------------------------------------------
// Human-in-the-loop
// ---------------------------------------------------------------------------

export interface HumanInputConfig {
  prompt: string;
  options?: Array<{ label: string; value: string }>;
  freeText?: boolean;
  defaultValue?: string;
}

export interface HumanInputResult {
  value: string;
}

export class HumanInputRequiredError extends Error {
  constructor(
    public readonly stageId: string,
    public readonly taskId: string,
    public readonly config: HumanInputConfig,
  ) {
    super(`Human input required at ${stageId}.${taskId}: ${config.prompt}`);
    this.name = 'HumanInputRequiredError';
  }
}

// ---------------------------------------------------------------------------
// Safeguards
// ---------------------------------------------------------------------------

export interface WorkflowSafeguards {
  /** Max total stage transitions (start + goto + retry). Default: 50 */
  maxTransitions: number;
  /** Max retries per individual stage. Default: 3 */
  maxStageRetries: number;
  /** Backoff ceiling for retries (ms). Default: 30000 */
  maxRetryDelayMs: number;
}

// ---------------------------------------------------------------------------
// Runtime state (held in xstate context, consumed by dashboard)
// ---------------------------------------------------------------------------

export interface WorkflowState {
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

export interface StageState {
  definition: StageDefinition;
  status: StageStatus;
  tasks: TaskState[];
  result?: StageResult;
  startedAt?: number;
  completedAt?: number;
}

export interface TaskState {
  definition: TaskDefinition;
  status: TaskStatus;
  output?: TaskOutput;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  logs: LogEntry[];
  streamBuffer: string;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  source: string; // "stage:<id>" or "task:<id>"
}

// ---------------------------------------------------------------------------
// Engine events (emitted by WorkflowEngine, consumed by xstate machine)
// ---------------------------------------------------------------------------

export type EngineEvent =
  | { type: 'workflow:started' }
  | { type: 'workflow:completed' }
  | { type: 'workflow:failed'; error: string }
  | {
      type: 'stage:started';
      stageId: string;
      stageIndex: number;
      tasks: TaskDefinition[];
    }
  | { type: 'stage:completed'; stageId: string; result: StageResult }
  | { type: 'stage:failed'; stageId: string; error: string }
  | { type: 'stage:skipped'; stageId: string }
  | { type: 'task:started'; stageId: string; taskId: string }
  | {
      type: 'task:completed';
      stageId: string;
      taskId: string;
      output: TaskOutput;
    }
  | { type: 'task:failed'; stageId: string; taskId: string; error: string }
  | { type: 'task:cancelled'; stageId: string; taskId: string }
  | {
      type: 'task:log';
      stageId: string;
      taskId: string;
      message: string;
      level: LogLevel;
    }
  | { type: 'task:stream'; stageId: string; taskId: string; text: string }
  | {
      type: 'task:waiting-for-input';
      stageId: string;
      taskId: string;
      config: HumanInputConfig;
    };

// ---------------------------------------------------------------------------
// Machine events (engine events + user actions)
// ---------------------------------------------------------------------------

export type WorkflowMachineEvent =
  | EngineEvent
  | { type: 'START' }
  | { type: 'ABORT' }
  | { type: 'HUMAN_INPUT'; value: string };
