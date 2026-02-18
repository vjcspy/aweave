---
name: workflow-builder
description: Build multi-step workflow CLI plugins using the workflow engine, xstate, and Ink dashboard. Use when creating a new workflow command, building a pipeline with stages and tasks, or when the user mentions workflow, pipeline, orchestration, or the workflow engine packages.
---

# Workflow Builder

Build workflow CLI plugins on `@hod/aweave-workflow-engine` + `@hod/aweave-workflow-dashboard`.

**Reference implementation:** `devtools/common/cli-plugin-demo-workflow/` (run with `aw demo`)
**Design document:** `devdocs/misc/devtools/common/_plans/260208-workflow-engine.md`

---

## Quick Start

A workflow is an oclif plugin with a single command that creates an xstate actor and renders the dashboard.

### 1. Create package

```
devtools/common/cli-plugin-<name>/
├── package.json
├── tsconfig.json
├── eslint.config.mjs
└── src/
    ├── index.ts          # empty (oclif auto-discovers)
    ├── commands/
    │   └── <name>.ts     # aw <name> [--format interactive|json]
    └── workflow.ts        # WorkflowDefinition
```

### 2. package.json (ESM)

```json
{
  "name": "@hod/aweave-plugin-<name>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": { "build": "tsc", "lint": "eslint .", "lint:fix": "eslint . --fix" },
  "oclif": { "commands": "./dist/commands", "topicSeparator": " " },
  "dependencies": {
    "@hod/aweave-workflow-engine": "workspace:*",
    "@hod/aweave-workflow-dashboard": "workspace:*",
    "@oclif/core": "^4.2.8",
    "ink": "^6.6.0",
    "react": "^19.0.0",
    "xstate": "^5"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/node": "^22.10.7",
    "typescript": "^5.7.3"
  }
}
```

### 3. tsconfig.json (ESM + JSX)

```json
{
  "compilerOptions": {
    "declaration": true, "module": "Node16", "moduleResolution": "node16",
    "outDir": "dist", "rootDir": "src", "strict": true, "target": "es2022",
    "jsx": "react-jsx", "esModuleInterop": true, "skipLibCheck": true
  },
  "include": ["./src/**/*"]
}
```

### 4. Command file

```typescript
// src/commands/<name>.ts
import { Command, Flags } from '@oclif/core';
import { render } from 'ink';
import React from 'react';
import { createActor } from 'xstate';
import type { WorkflowActor } from '@hod/aweave-workflow-engine';
import { workflowMachine } from '@hod/aweave-workflow-engine';
import { WorkflowDashboard } from '@hod/aweave-workflow-dashboard';
import { myWorkflow } from '../workflow.js';

export default class MyCommand extends Command {
  static description = 'Run my workflow';
  static flags = {
    format: Flags.string({
      default: 'interactive', options: ['interactive', 'json'],
      description: 'Output format',
    }),
    // ... workflow-specific flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MyCommand);
    const actor = createActor(workflowMachine, {
      input: { definition: myWorkflow, workflowInput: { /* from flags */ } },
    });

    const canInteractive = flags.format === 'interactive'
      && process.stdin.isTTY
      && typeof process.stdin.setRawMode === 'function';

    if (canInteractive) {
      actor.start();
      actor.send({ type: 'START' });
      const { waitUntilExit } = render(React.createElement(WorkflowDashboard, { actor }));
      await waitUntilExit();
    } else {
      // JSON fallback — see demo command for full implementation
      await this.runJSON(actor);
    }
  }
}
```

### 5. Register plugin

1. Add to `devtools/pnpm-workspace.yaml`
2. Add to `devtools/common/cli/package.json` — both `dependencies` and `oclif.plugins`
3. `pnpm install --no-frozen-lockfile && pnpm build`

---

## WorkflowDefinition Structure

```typescript
const myWorkflow: WorkflowDefinition = {
  id: 'my-workflow',
  name: 'My Workflow',
  description: 'What this workflow does',
  stages: [
    { id: 'stage-1', name: 'Stage 1', execution: 'parallel', tasks: [...] },
    { id: 'stage-2', name: 'Stage 2', execution: 'sequential', prepareTasks: (ctx) => [...] },
    // ...
  ],
  safeguards: { maxTransitions: 50, maxStageRetries: 3, maxRetryDelayMs: 30000 },
};
```

---

## Feature Catalog

### Sequential tasks

Tasks run one after another. Each task can access previous tasks' outputs via `ctx.previousTaskResults`.

```typescript
{
  id: 'build-deploy',
  name: 'Build & Deploy',
  execution: 'sequential',
  tasks: [
    { id: 'build', name: 'Build', handler: buildHandler },
    { id: 'deploy', name: 'Deploy', handler: deployHandler },  // can read build output
  ],
}
```

### Parallel tasks

All tasks run concurrently. Uses `Promise.allSettled` — collects all results even if some fail.

```typescript
{
  id: 'validate',
  name: 'Validate',
  execution: 'parallel',
  tasks: [
    { id: 'check-a', name: 'Check A', handler: checkA },
    { id: 'check-b', name: 'Check B', handler: checkB },
  ],
}
```

### Race tasks

All tasks start concurrently. First to succeed wins, rest are cancelled via `AbortSignal`.

**Handler MUST respect `ctx.signal`:**

```typescript
const searchHandler: TaskHandler = async (ctx) => {
  for (const item of items) {
    if (ctx.signal.aborted) return { data: null };  // REQUIRED
    await sleep(100, ctx.signal);                    // pass signal to async ops
    // ... work
  }
  return { data: result };
};
```

### Dynamic tasks (`prepareTasks`)

Generate tasks at runtime from previous stage outputs. Mutually exclusive with `tasks`.

```typescript
{
  id: 'analyze',
  name: 'Analyze',
  execution: 'parallel',
  prepareTasks: (ctx) => {
    const items = ctx.stageResults['discover'].tasks['scan'].data as string[];
    return items.map(item => ({
      id: `analyze-${item}`,
      name: `Analyze ${item}`,
      handler: createAnalyzeHandler(item),
    }));
  },
}
```

### Stage reducer

Aggregate per-task outputs into a single value. Stored in `StageResult.aggregated`.

```typescript
{
  id: 'analysis',
  execution: 'parallel',
  prepareTasks: (ctx) => [...],
  reducer: (taskOutputs) => {
    let totalIssues = 0;
    for (const output of Object.values(taskOutputs)) {
      totalIssues += (output.data as any).issues;
    }
    return { totalIssues };
  },
}
```

Access aggregated result: `ctx.stageResults['analysis'].aggregated`

### Conditional stage

Skip a stage based on previous results.

```typescript
{
  id: 'deploy',
  name: 'Deploy',
  execution: 'sequential',
  condition: (ctx) => {
    const decision = ctx.stageResults['review'].tasks['approval'].data as { approved: boolean };
    return decision.approved;
  },
  tasks: [...],
}
```

### Human-in-the-loop

Pause and wait for user input. Dashboard renders option selector or text input.

```typescript
const handler: TaskHandler = async (ctx) => {
  const { value } = await ctx.waitForInput({
    prompt: 'Select an option:',
    options: [
      { label: 'Option A', value: 'a' },
      { label: 'Option B', value: 'b' },
    ],
  });
  // value === 'a' or 'b'
  return { data: { choice: value } };
};
```

For free text: `{ prompt: 'Enter value:', freeText: true, defaultValue: 'hello' }`

### Retry with backoff

```typescript
{
  id: 'deploy',
  name: 'Deploy',
  handler: deployHandler,
  retry: { maxAttempts: 3, delayMs: 1000, backoff: 'exponential' },
}
```

Handler can check `ctx.execution.attempt` for attempt-aware logic.

### Timeout

```typescript
{ id: 'notify', name: 'Notify', handler: notifyHandler, timeout: 10_000 }
```

Throws `TimeoutError` after 10 seconds, which triggers retry or `onFailed`.

### Error handling (`onFailed`)

Control what happens when a stage fails.

```typescript
{
  id: 'notify',
  name: 'Notify',
  execution: 'sequential',
  tasks: [...],
  onFailed: (ctx) => {
    // Options:
    // { action: 'abort' }              — stop workflow (default)
    // { action: 'skip' }               — continue to next stage
    // { action: 'goto', stageId: 'x' } — jump to stage
    // { action: 'retry' }              — retry entire stage
    return { action: 'skip' };  // notification failure shouldn't block workflow
  },
}
```

### Logging and streaming

```typescript
const handler: TaskHandler = async (ctx) => {
  ctx.log('Starting process...');              // info log
  ctx.log('Something concerning', 'warn');     // warn log
  ctx.log('Something broke', 'error');         // error log

  ctx.stream('  Building module...\n');        // streaming text to main panel
  ctx.stream('  Done.\n');

  return { data: result, summary: 'Built OK', detail: 'Full output here' };
};
```

---

## Task Handler Pattern

```typescript
const myHandler: TaskHandler = async (ctx) => {
  // 1. Log start
  ctx.log('Starting...');

  // 2. Access previous results
  const prevData = ctx.stageResults['prev-stage'].tasks['task-id'].data;

  // 3. Do work (respect signal for race support)
  for (const item of items) {
    if (ctx.signal.aborted) return { data: null, summary: 'Cancelled' };
    await doWork(item);
    ctx.stream(`  Processed ${item}\n`);
  }

  // 4. Log completion
  ctx.log('Completed');

  // 5. Return output
  return {
    data: { resultKey: resultValue },       // consumed by downstream tasks
    summary: 'One-line summary for sidebar', // shown in task tree
    detail: 'Multi-line detail\nfor main panel', // shown when task selected
  };
};
```

---

## Pitfalls & Lessons Learned

### 1. Race handlers MUST check `ctx.signal.aborted`

If a race handler doesn't check the signal, it continues running after another task wins. Always guard loops and async operations.

### 2. Non-interactive mode needs `setTimeout` for human input

Auto-resolving human input in `actor.subscribe()` causes re-entrant xstate updates. Always defer with `setTimeout`:

```typescript
actor.subscribe((snapshot) => {
  if (ctx.humanInput && ctx.status === 'paused') {
    setTimeout(() => actor.send({ type: 'HUMAN_INPUT', value: autoValue }), 10);
  }
});
```

### 3. TTY check before Ink render

Ink's `useInput` requires raw mode. Check before rendering:

```typescript
const canInteractive = process.stdin.isTTY && typeof process.stdin.setRawMode === 'function';
```

### 4. `sleep()` must accept AbortSignal

Use the engine's `sleep(ms, signal)` helper or implement your own. Plain `setTimeout` ignores cancellation:

```typescript
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Aborted')); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')); }, { once: true });
  });
}
```

### 5. Task IDs must be unique within a stage

For dynamic tasks, use a prefix pattern: `analyze-${moduleName}`. Duplicate IDs cause result overwriting.

### 6. Don't put UI state in xstate

xstate final states don't process events. Any state that must be interactive after workflow completion (e.g., task selection) must be React state in the dashboard component.

---

## Checklist

- [ ] `WorkflowDefinition` created with `id`, `name`, `stages`
- [ ] Each stage has `id`, `name`, `execution` strategy
- [ ] Task handlers return `{ data, summary?, detail? }`
- [ ] Race handlers check `ctx.signal.aborted`
- [ ] Command has `--format` flag with TTY fallback
- [ ] Plugin registered in `pnpm-workspace.yaml` and `cli/package.json`
- [ ] `pnpm build` passes across all 3 packages (engine → dashboard → plugin)
- [ ] `pnpm lint:fix` passes
- [ ] `aw <command> --help` works
