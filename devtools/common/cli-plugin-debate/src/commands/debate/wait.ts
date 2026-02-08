import {
  ContentType,
  handleServerError,
  HTTPClientError,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import type { DebateState, Role } from '@aweave/debate-machine';
import { getAvailableActions } from '@aweave/debate-machine';
import { Command, Flags } from '@oclif/core';

import { DEBATE_WAIT_DEADLINE, POLL_INTERVAL } from '../../lib/config';
import { getClient, sleep } from '../../lib/helpers';

export class DebateWait extends Command {
  static description = 'Wait for a new argument (interval polling)';

  static flags = {
    'debate-id': Flags.string({ required: true, description: 'Debate UUID' }),
    role: Flags.string({
      required: true,
      description: 'Role: proposer|opponent',
    }),
    'argument-id': Flags.string({ description: 'Last seen argument UUID' }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DebateWait);
    const client = getClient();
    const start = Date.now();
    const deadlineMs = DEBATE_WAIT_DEADLINE * 1000;
    let lastSeenSeq = 0;

    while (Date.now() - start < deadlineMs) {
      try {
        const resp = await client.get(`/debates/${flags['debate-id']}/poll`, {
          argument_id: flags['argument-id'] ?? '',
          role: flags.role,
        });

        const data = (resp.data ?? {}) as Record<string, unknown>;

        if (data.has_new_argument) {
          const argument = data.argument as Record<string, unknown>;
          const debateState = data.debate_state as DebateState;

          output(
            new MCPResponse({
              success: true,
              content: [
                new MCPContent({
                  type: ContentType.JSON,
                  data: {
                    status: 'new_argument',
                    action: data.action,
                    debate_state: debateState,
                    argument,
                    next_argument_id_to_wait: argument.id,
                    available_actions: getAvailableActions(
                      debateState,
                      flags.role as Role,
                    ),
                  },
                }),
              ],
            }),
            flags.format,
            true,
          );
          return;
        }

        lastSeenSeq = (data.last_seen_seq as number) ?? lastSeenSeq;
      } catch (e) {
        if (e instanceof HTTPClientError) handleServerError(e, flags.format);
      }

      await sleep(POLL_INTERVAL * 1000);
    }

    const retryCmd =
      `aw debate wait --debate-id ${flags['debate-id']} --role ${flags.role}` +
      (flags['argument-id'] ? ` --argument-id ${flags['argument-id']}` : '');

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: {
              status: 'timeout',
              message: `No response after ${DEBATE_WAIT_DEADLINE}s. you MUST retry by using: ${retryCmd}`,
              debate_id: flags['debate-id'],
              last_argument_id: flags['argument-id'],
              last_seen_seq: lastSeenSeq,
              retry_command: retryCmd,
            },
          }),
        ],
      }),
      flags.format,
    );
  }
}
