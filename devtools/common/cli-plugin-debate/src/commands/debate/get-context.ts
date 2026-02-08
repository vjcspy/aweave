import {
  ContentType,
  handleServerError,
  HTTPClientError,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import type { DebateState } from '@aweave/debate-machine';
import { getAvailableActions } from '@aweave/debate-machine';
import { Command, Flags } from '@oclif/core';

import { getClient } from '../../lib/helpers';

export class DebateGetContext extends Command {
  static description = 'Get debate context (debate + motion + arguments)';

  static flags = {
    'debate-id': Flags.string({ required: true, description: 'Debate UUID' }),
    limit: Flags.integer({ description: 'Number of recent arguments' }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DebateGetContext);

    try {
      const client = getClient();
      const params: Record<string, string> = {};
      if (flags.limit !== undefined) params.limit = String(flags.limit);

      const resp = await client.get(
        `/debates/${flags['debate-id']}`,
        Object.keys(params).length > 0 ? params : undefined,
      );
      const data = (resp.data ?? {}) as Record<string, unknown>;

      // Enrich with available actions per role (computed via xstate machine)
      const debate = (data.debate ?? {}) as Record<string, unknown>;
      const state = debate.state as DebateState | undefined;
      if (state) {
        data.available_actions = {
          proposer: getAvailableActions(state, 'proposer'),
          opponent: getAvailableActions(state, 'opponent'),
          arbitrator: getAvailableActions(state, 'arbitrator'),
        };
      }

      output(
        new MCPResponse({
          success: true,
          content: [new MCPContent({ type: ContentType.JSON, data })],
        }),
        flags.format,
        true,
      );
    } catch (e) {
      if (e instanceof HTTPClientError) handleServerError(e, flags.format);
      throw e;
    }
  }
}
