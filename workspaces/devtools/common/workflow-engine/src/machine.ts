/**
 * xstate v5 workflow machine — Lifecycle + Event Bridge.
 *
 * States: idle → running → completed / failed / aborted
 * Invokes WorkflowEngine via fromCallback actor.
 * Engine events → sendBack → xstate context updates → React re-render.
 */

import { type ActorRefFrom, assign, fromCallback, sendTo, setup } from 'xstate';

import { WorkflowEngine } from './engine';
import type {
  EngineEvent,
  LogEntry,
  StageState,
  TaskDefinition,
  TaskState,
  WorkflowDefinition,
  WorkflowMachineEvent,
  WorkflowState,
} from './types';

// ---------------------------------------------------------------------------
// Context update helpers (immutable)
// ---------------------------------------------------------------------------

function updateStageById(
  stages: StageState[],
  stageId: string,
  updater: (stage: StageState) => StageState,
): StageState[] {
  return stages.map((s) => (s.definition.id === stageId ? updater(s) : s));
}

function updateTaskInStage(
  stages: StageState[],
  stageId: string,
  taskId: string,
  updater: (task: TaskState) => TaskState,
): StageState[] {
  return stages.map((s) =>
    s.definition.id === stageId
      ? {
          ...s,
          tasks: s.tasks.map((t) =>
            t.definition.id === taskId ? updater(t) : t,
          ),
        }
      : s,
  );
}

function createTaskState(taskDef: TaskDefinition): TaskState {
  return {
    definition: taskDef,
    status: 'pending',
    logs: [],
    streamBuffer: '',
  };
}

// ---------------------------------------------------------------------------
// Machine input type
// ---------------------------------------------------------------------------

export interface WorkflowMachineInput {
  definition: WorkflowDefinition;
  workflowInput: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Machine definition
// ---------------------------------------------------------------------------

export const workflowMachine = setup({
  types: {
    context: {} as WorkflowState,
    events: {} as WorkflowMachineEvent,
    input: {} as WorkflowMachineInput,
  },
  actors: {
    runWorkflow: fromCallback<
      { type: 'HUMAN_INPUT'; value: string },
      { definition: WorkflowDefinition; workflowInput: Record<string, unknown> }
    >(({ sendBack, receive, input }) => {
      const engine = new WorkflowEngine(input.definition, input.workflowInput);

      // Bridge ALL engine events to xstate
      engine.on('event', (event: EngineEvent) => {
        sendBack(event);
      });

      // Human input: xstate → engine
      receive((event) => {
        if (event.type === 'HUMAN_INPUT') {
          engine.resolveHumanInput(event.value);
        }
      });

      engine.run();

      // Cleanup — abort engine when actor is stopped
      return () => engine.abort();
    }),
  },
}).createMachine({
  id: 'workflow',
  initial: 'idle',

  context: ({ input }) => ({
    status: 'idle' as const,
    definition: input.definition,
    input: input.workflowInput,
    stages: input.definition.stages.map(
      (stageDef): StageState => ({
        definition: stageDef,
        status: 'pending',
        tasks: (stageDef.tasks ?? []).map(createTaskState),
      }),
    ),
    currentStageIndex: -1,
    logs: [],
    humanInput: null,
  }),

  states: {
    idle: {
      on: {
        START: { target: 'running' },
      },
    },

    running: {
      entry: assign({
        status: () => 'running' as const,
        startedAt: () => Date.now(),
      }),

      invoke: {
        id: 'workflowRunner',
        src: 'runWorkflow',
        input: ({ context }) => ({
          definition: context.definition,
          workflowInput: context.input,
        }),
      },

      on: {
        // ----- Engine lifecycle events -----

        'workflow:completed': {
          target: 'completed',
          actions: assign({
            status: () => 'completed' as const,
            completedAt: () => Date.now(),
          }),
        },

        'workflow:failed': {
          target: 'failed',
          actions: assign({
            status: () => 'failed' as const,
            error: ({ event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'workflow:failed' }
              >;
              return e.error;
            },
            completedAt: () => Date.now(),
          }),
        },

        // ----- Stage events -----

        'stage:started': {
          actions: assign({
            currentStageIndex: ({ event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'stage:started' }
              >;
              return e.stageIndex;
            },
            stages: ({ context, event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'stage:started' }
              >;
              return updateStageById(context.stages, e.stageId, (stage) => ({
                ...stage,
                status: 'running',
                startedAt: Date.now(),
                tasks: e.tasks.map(createTaskState),
              }));
            },
          }),
        },

        'stage:completed': {
          actions: assign({
            stages: ({ context, event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'stage:completed' }
              >;
              return updateStageById(context.stages, e.stageId, (stage) => ({
                ...stage,
                status: 'success',
                result: e.result,
                completedAt: Date.now(),
              }));
            },
          }),
        },

        'stage:failed': {
          actions: assign({
            stages: ({ context, event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'stage:failed' }
              >;
              return updateStageById(context.stages, e.stageId, (stage) => ({
                ...stage,
                status: 'failed',
                completedAt: Date.now(),
              }));
            },
          }),
        },

        'stage:skipped': {
          actions: assign({
            stages: ({ context, event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'stage:skipped' }
              >;
              return updateStageById(context.stages, e.stageId, (stage) => ({
                ...stage,
                status: 'skipped',
              }));
            },
          }),
        },

        // ----- Task events -----

        'task:started': {
          actions: assign({
            stages: ({ context, event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'task:started' }
              >;
              return updateTaskInStage(
                context.stages,
                e.stageId,
                e.taskId,
                (task) => ({
                  ...task,
                  status: 'running',
                  startedAt: Date.now(),
                  error: undefined,
                }),
              );
            },
          }),
        },

        'task:completed': {
          actions: assign({
            stages: ({ context, event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'task:completed' }
              >;
              const now = Date.now();
              return updateTaskInStage(
                context.stages,
                e.stageId,
                e.taskId,
                (task) => ({
                  ...task,
                  status: 'success',
                  output: e.output,
                  completedAt: now,
                  duration: task.startedAt ? now - task.startedAt : undefined,
                }),
              );
            },
          }),
        },

        'task:failed': {
          actions: assign({
            stages: ({ context, event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'task:failed' }
              >;
              const now = Date.now();
              return updateTaskInStage(
                context.stages,
                e.stageId,
                e.taskId,
                (task) => ({
                  ...task,
                  status: 'failed',
                  error: e.error,
                  completedAt: now,
                  duration: task.startedAt ? now - task.startedAt : undefined,
                }),
              );
            },
          }),
        },

        'task:cancelled': {
          actions: assign({
            stages: ({ context, event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'task:cancelled' }
              >;
              return updateTaskInStage(
                context.stages,
                e.stageId,
                e.taskId,
                (task) => ({
                  ...task,
                  status: 'cancelled',
                }),
              );
            },
          }),
        },

        'task:log': {
          actions: assign({
            stages: ({ context, event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'task:log' }
              >;
              const entry: LogEntry = {
                timestamp: Date.now(),
                level: e.level,
                message: e.message,
                source: `task:${e.taskId}`,
              };
              return updateTaskInStage(
                context.stages,
                e.stageId,
                e.taskId,
                (task) => ({
                  ...task,
                  logs: [...task.logs, entry],
                }),
              );
            },
            logs: ({ context, event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'task:log' }
              >;
              const entry: LogEntry = {
                timestamp: Date.now(),
                level: e.level,
                message: e.message,
                source: `task:${e.taskId}`,
              };
              return [...context.logs, entry];
            },
          }),
        },

        'task:stream': {
          actions: assign({
            stages: ({ context, event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'task:stream' }
              >;
              return updateTaskInStage(
                context.stages,
                e.stageId,
                e.taskId,
                (task) => ({
                  ...task,
                  streamBuffer: task.streamBuffer + e.text,
                }),
              );
            },
          }),
        },

        'task:waiting-for-input': {
          actions: assign({
            status: () => 'paused' as const,
            humanInput: ({ event }) => {
              const e = event as Extract<
                WorkflowMachineEvent,
                { type: 'task:waiting-for-input' }
              >;
              return { ...e.config, stageId: e.stageId, taskId: e.taskId };
            },
          }),
        },

        // ----- User actions -----

        HUMAN_INPUT: {
          actions: [
            assign({
              humanInput: () => null,
              status: () => 'running' as const,
            }),
            sendTo('workflowRunner', ({ event }) => event),
          ],
        },

        ABORT: {
          target: 'aborted',
          actions: assign({
            status: () => 'aborted' as const,
            completedAt: () => Date.now(),
          }),
        },
      },
    },

    completed: { type: 'final' },
    failed: { type: 'final' },
    aborted: { type: 'final' },
  },
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type WorkflowActor = ActorRefFrom<typeof workflowMachine>;
