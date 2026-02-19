/**
 * WorkflowEngine — Pure TypeScript execution engine.
 *
 * Interprets a WorkflowDefinition, runs stages sequentially, executes tasks
 * per strategy (sequential / parallel / race), and emits events via EventEmitter.
 *
 * Does NOT know about xstate or Ink — those are separate layers.
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

import { sleep, withTimeout } from './helpers';
import type {
  EngineEvent,
  FailureContext,
  HumanInputConfig,
  HumanInputResult,
  StageContext,
  StageResult,
  TaskContext,
  TaskDefinition,
  TaskOutput,
  WorkflowDefinition,
  WorkflowSafeguards,
} from './types';

const DEFAULT_SAFEGUARDS: WorkflowSafeguards = {
  maxTransitions: 50,
  maxStageRetries: 3,
  maxRetryDelayMs: 30_000,
};

export class WorkflowEngine extends EventEmitter {
  private readonly definition: WorkflowDefinition;
  private readonly input: Record<string, unknown>;
  private readonly stageResults: Record<string, StageResult> = {};
  private readonly abortController = new AbortController();
  private readonly runId: string;
  private readonly safeguards: WorkflowSafeguards;

  private humanInputResolve: ((value: string) => void) | null = null;
  private transitionCount = 0;
  private stageRetryCounts: Record<string, number> = {};
  private gotoHistory: Record<string, number> = {};

  constructor(definition: WorkflowDefinition, input: Record<string, unknown>) {
    super();
    this.definition = definition;
    this.input = input;
    this.runId = randomUUID();
    this.safeguards = { ...DEFAULT_SAFEGUARDS, ...definition.safeguards };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async run(): Promise<void> {
    this.send({ type: 'workflow:started' });

    const stages = this.definition.stages;
    let currentIndex = 0;

    try {
      while (currentIndex < stages.length) {
        if (this.abortController.signal.aborted) {
          this.send({ type: 'workflow:failed', error: 'Workflow aborted' });
          return;
        }

        // Safeguard: max transitions
        this.transitionCount++;
        if (this.transitionCount > this.safeguards.maxTransitions) {
          this.send({
            type: 'workflow:failed',
            error: `Max transitions exceeded (${this.safeguards.maxTransitions})`,
          });
          return;
        }

        const stage = stages[currentIndex];
        const stageCtx: StageContext = {
          input: this.input,
          stageResults: this.stageResults,
        };

        // Check condition
        if (stage.condition && !stage.condition(stageCtx)) {
          this.send({ type: 'stage:skipped', stageId: stage.id });
          currentIndex++;
          continue;
        }

        // Resolve tasks (static or dynamic)
        const tasks = stage.prepareTasks
          ? stage.prepareTasks(stageCtx)
          : (stage.tasks ?? []);

        this.send({
          type: 'stage:started',
          stageId: stage.id,
          stageIndex: currentIndex,
          tasks,
        });

        try {
          const taskOutputs = await this.executeStage(
            stage.execution,
            stage.id,
            tasks,
          );

          const result: StageResult = {
            status: 'success',
            tasks: taskOutputs,
            aggregated: stage.reducer ? stage.reducer(taskOutputs) : undefined,
          };

          this.stageResults[stage.id] = result;
          this.send({ type: 'stage:completed', stageId: stage.id, result });
          currentIndex++;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));

          this.send({
            type: 'stage:failed',
            stageId: stage.id,
            error: error.message,
          });

          const failureCtx: FailureContext = {
            error,
            stageId: stage.id,
            failedTaskIds: this.getFailedTaskIds(stage.id, tasks),
            stageResults: this.stageResults,
            input: this.input,
          };

          const transition = stage.onFailed
            ? stage.onFailed(failureCtx)
            : { action: 'abort' as const };

          switch (transition.action) {
            case 'abort':
              this.send({ type: 'workflow:failed', error: error.message });
              return;

            case 'skip':
              this.stageResults[stage.id] = { status: 'failed', tasks: {} };
              currentIndex++;
              break;

            case 'goto': {
              const targetIndex = stages.findIndex(
                (s) => s.id === transition.stageId,
              );
              if (targetIndex === -1) {
                this.send({
                  type: 'workflow:failed',
                  error: `goto target stage "${transition.stageId}" not found`,
                });
                return;
              }
              // Cycle detection
              const gotoKey = `${stage.id}->${transition.stageId}`;
              this.gotoHistory[gotoKey] = (this.gotoHistory[gotoKey] ?? 0) + 1;
              if (this.gotoHistory[gotoKey] > this.safeguards.maxStageRetries) {
                this.send({
                  type: 'workflow:failed',
                  error: `Cycle detected: goto ${gotoKey} exceeded max retries`,
                });
                return;
              }
              currentIndex = targetIndex;
              break;
            }

            case 'retry': {
              this.stageRetryCounts[stage.id] =
                (this.stageRetryCounts[stage.id] ?? 0) + 1;
              if (
                this.stageRetryCounts[stage.id] >
                this.safeguards.maxStageRetries
              ) {
                this.send({
                  type: 'workflow:failed',
                  error: `Max retries exceeded for stage "${stage.id}"`,
                });
                return;
              }
              // Stay at same index — loop will re-run this stage
              break;
            }
          }
        }
      }

      this.send({ type: 'workflow:completed' });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.send({ type: 'workflow:failed', error: error.message });
    }
  }

  /** Resolve a pending human input request */
  resolveHumanInput(value: string): void {
    this.humanInputResolve?.(value);
  }

  /** Abort the workflow */
  abort(): void {
    this.abortController.abort();
  }

  // -------------------------------------------------------------------------
  // Execution strategies
  // -------------------------------------------------------------------------

  private async executeStage(
    strategy: string,
    stageId: string,
    tasks: TaskDefinition[],
  ): Promise<Record<string, TaskOutput>> {
    switch (strategy) {
      case 'sequential':
        return this.executeSequential(stageId, tasks);
      case 'parallel':
        return this.executeParallel(stageId, tasks);
      case 'race':
        return this.executeRace(stageId, tasks);
      default:
        throw new Error(`Unknown execution strategy: ${strategy}`);
    }
  }

  private async executeSequential(
    stageId: string,
    tasks: TaskDefinition[],
  ): Promise<Record<string, TaskOutput>> {
    const results: Record<string, TaskOutput> = {};

    for (const task of tasks) {
      if (this.abortController.signal.aborted) {
        throw new Error('Workflow aborted');
      }
      const output = await this.executeTask(
        stageId,
        task,
        results,
        this.abortController.signal,
      );
      results[task.id] = output;
    }

    return results;
  }

  private async executeParallel(
    stageId: string,
    tasks: TaskDefinition[],
  ): Promise<Record<string, TaskOutput>> {
    const settlements = await Promise.allSettled(
      tasks.map(async (task) => {
        const output = await this.executeTask(
          stageId,
          task,
          {},
          this.abortController.signal,
        );
        return { taskId: task.id, output };
      }),
    );

    const results: Record<string, TaskOutput> = {};
    const errors: string[] = [];

    for (let i = 0; i < settlements.length; i++) {
      const settlement = settlements[i];
      if (settlement.status === 'fulfilled') {
        results[settlement.value.taskId] = settlement.value.output;
      } else {
        errors.push(
          `${tasks[i].id}: ${settlement.reason?.message ?? 'Unknown error'}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(`Parallel tasks failed: ${errors.join('; ')}`);
    }

    return results;
  }

  private async executeRace(
    stageId: string,
    tasks: TaskDefinition[],
  ): Promise<Record<string, TaskOutput>> {
    const raceController = new AbortController();

    // Link to parent abort
    const onAbort = () => raceController.abort();
    this.abortController.signal.addEventListener('abort', onAbort);

    try {
      const result = await new Promise<{ taskId: string; output: TaskOutput }>(
        (resolve, reject) => {
          let failCount = 0;
          let settled = false;

          tasks.forEach((task) => {
            this.executeTask(stageId, task, {}, raceController.signal)
              .then((output) => {
                if (!settled) {
                  settled = true;
                  raceController.abort();
                  resolve({ taskId: task.id, output });
                }
              })
              .catch(() => {
                failCount++;
                if (failCount === tasks.length && !settled) {
                  settled = true;
                  reject(new Error('All race tasks failed'));
                }
              });
          });
        },
      );

      // Mark non-winner tasks as cancelled
      for (const task of tasks) {
        if (task.id !== result.taskId) {
          this.send({ type: 'task:cancelled', stageId, taskId: task.id });
        }
      }

      return { [result.taskId]: result.output };
    } finally {
      this.abortController.signal.removeEventListener('abort', onAbort);
    }
  }

  // -------------------------------------------------------------------------
  // Task execution with retry
  // -------------------------------------------------------------------------

  private async executeTask(
    stageId: string,
    task: TaskDefinition,
    previousResults: Record<string, TaskOutput>,
    signal: AbortSignal,
  ): Promise<TaskOutput> {
    const maxAttempts = task.retry?.maxAttempts ?? 1;
    const delayMs = task.retry?.delayMs ?? 1000;
    const backoff = task.retry?.backoff ?? 'fixed';
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal.aborted) throw new Error('Task cancelled');

      this.send({ type: 'task:started', stageId, taskId: task.id });

      const ctx: TaskContext = {
        input: this.input,
        stageResults: this.stageResults,
        previousTaskResults: previousResults,
        signal,
        log: (message, level = 'info') => {
          this.send({
            type: 'task:log',
            stageId,
            taskId: task.id,
            message,
            level,
          });
        },
        stream: (text) => {
          this.send({ type: 'task:stream', stageId, taskId: task.id, text });
        },
        waitForInput: (config) => this.waitForInput(stageId, task.id, config),
        execution: {
          runId: this.runId,
          attempt,
          idempotencyKey: `${this.runId}:${stageId}:${task.id}:${attempt}`,
        },
      };

      try {
        const output = task.timeout
          ? await withTimeout(task.handler(ctx), task.timeout)
          : await task.handler(ctx);

        this.send({ type: 'task:completed', stageId, taskId: task.id, output });
        return output;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // If cancelled by abort signal (e.g., race loser), don't emit task:failed.
        // The race handler will emit task:cancelled instead.
        if (signal.aborted) {
          throw lastError;
        }

        if (attempt < maxAttempts) {
          this.send({
            type: 'task:log',
            stageId,
            taskId: task.id,
            message: `Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying...`,
            level: 'warn',
          });
          const delay =
            backoff === 'exponential'
              ? Math.min(
                  delayMs * Math.pow(2, attempt - 1),
                  this.safeguards.maxRetryDelayMs,
                )
              : delayMs;
          await sleep(delay);
        }
      }
    }

    // Only emit task:failed if not cancelled by signal
    if (!signal.aborted) {
      this.send({
        type: 'task:failed',
        stageId,
        taskId: task.id,
        error: lastError!.message,
      });
    }
    throw lastError!;
  }

  // -------------------------------------------------------------------------
  // Human-in-the-loop
  // -------------------------------------------------------------------------

  private async waitForInput(
    stageId: string,
    taskId: string,
    config: HumanInputConfig,
  ): Promise<HumanInputResult> {
    this.send({ type: 'task:waiting-for-input', stageId, taskId, config });

    return new Promise<HumanInputResult>((resolve) => {
      this.humanInputResolve = (value: string) => {
        this.humanInputResolve = null;
        resolve({ value });
      };
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private send(event: EngineEvent): void {
    this.emit('event', event);
  }

  private getFailedTaskIds(
    _stageId: string,
    tasks: TaskDefinition[],
  ): string[] {
    // During execution, we track failures inline. For the FailureContext,
    // we return all task IDs as potentially failed (the stage failed).
    return tasks.map((t) => t.id);
  }
}
