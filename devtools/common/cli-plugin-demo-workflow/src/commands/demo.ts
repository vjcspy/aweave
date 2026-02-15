/**
 * `aw demo` — Run the demo workflow to showcase the workflow engine.
 *
 * Interactive mode (default): Ink dashboard with live updates
 * JSON mode (--format json): Structured output for scripting
 *
 * Falls back to JSON mode automatically if the terminal doesn't support
 * raw mode (e.g., piped stdin, some IDE terminals).
 */

import { WorkflowDashboard } from '@hod/aweave-workflow-dashboard';
import type { WorkflowActor } from '@hod/aweave-workflow-engine';
import { workflowMachine } from '@hod/aweave-workflow-engine';
import { Command, Flags } from '@oclif/core';
import { render } from 'ink';
import React from 'react';
import { createActor } from 'xstate';

import { demoWorkflow } from '../workflow.js';

export default class Demo extends Command {
  static description =
    'Run demo workflow showcasing the workflow engine features';

  static examples = [
    '<%= config.bin %> demo',
    '<%= config.bin %> demo --format json',
  ];

  static flags = {
    format: Flags.string({
      default: 'interactive',
      options: ['interactive', 'json'],
      description: 'Output format: interactive (Ink dashboard) or json',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Demo);

    const actor = createActor(workflowMachine, {
      input: {
        definition: demoWorkflow,
        workflowInput: {},
      },
    });

    const wantInteractive = flags.format === 'interactive';
    const canInteractive =
      wantInteractive &&
      process.stdin.isTTY &&
      typeof process.stdin.setRawMode === 'function';

    if (wantInteractive && !canInteractive) {
      this.log(
        'Terminal does not support interactive mode (no TTY/raw mode). Falling back to JSON output.',
      );
    }

    if (canInteractive) {
      await this.runInteractive(actor);
    } else {
      await this.runJSON(actor);
    }
  }

  private async runInteractive(actor: WorkflowActor): Promise<void> {
    actor.start();
    actor.send({ type: 'START' });

    const { waitUntilExit } = render(
      React.createElement(WorkflowDashboard, { actor }),
    );
    await waitUntilExit();
  }

  private async runJSON(actor: WorkflowActor): Promise<void> {
    let lastLogIndex = 0;

    return new Promise((resolve) => {
      actor.subscribe((snapshot) => {
        const ctx = snapshot.context;

        // Print only NEW log entries (avoid duplicates from re-renders)
        while (lastLogIndex < ctx.logs.length) {
          const log = ctx.logs[lastLogIndex];
          const ts = new Date(log.timestamp).toISOString().slice(11, 19);
          process.stderr.write(
            `[${ts}] [${log.level.toUpperCase().padEnd(5)}] ${log.message}\n`,
          );
          lastLogIndex++;
        }

        // Auto-resolve human input in non-interactive mode
        // Uses first option or default value. Deferred to avoid re-entrant xstate updates.
        if (ctx.humanInput && ctx.status === 'paused') {
          const autoValue =
            ctx.humanInput.defaultValue ??
            ctx.humanInput.options?.[0]?.value ??
            '';
          process.stderr.write(
            `[AUTO] Human input auto-resolved: "${autoValue}" (non-interactive mode)\n`,
          );
          setTimeout(() => {
            actor.send({ type: 'HUMAN_INPUT', value: autoValue });
          }, 10);
        }

        // Print final output when done
        if (
          ctx.status === 'completed' ||
          ctx.status === 'failed' ||
          ctx.status === 'aborted'
        ) {
          const stages = ctx.stages.map((s) => ({
            id: s.definition.id,
            name: s.definition.name,
            status: s.status,
            tasks: s.tasks.map((t) => ({
              id: t.definition.id,
              name: t.definition.name,
              status: t.status,
              duration: t.duration,
              summary: t.output?.summary,
              error: t.error,
            })),
          }));

          const output = {
            status: ctx.status,
            stages,
            error: ctx.error,
            startedAt: ctx.startedAt,
            completedAt: ctx.completedAt,
            durationMs:
              ctx.completedAt && ctx.startedAt
                ? ctx.completedAt - ctx.startedAt
                : undefined,
          };

          this.log(JSON.stringify(output, null, 2));
          resolve();
        }
      });

      actor.start();
      actor.send({ type: 'START' });
    });
  }
}
