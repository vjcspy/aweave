import {
  ContentType,
  handleServerError,
  HTTPClientError,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';

import { filterWriteResponse, getClient } from '../../lib/helpers';

export class DebateIntervention extends Command {
  static description = 'Submit an INTERVENTION as Arbitrator (DEV-ONLY)';

  static flags = {
    'debate-id': Flags.string({ required: true, description: 'Debate UUID' }),
    'client-request-id': Flags.string({ description: 'Idempotency key' }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DebateIntervention);

    const body: Record<string, unknown> = {};
    if (flags['client-request-id'])
      body.client_request_id = flags['client-request-id'];

    try {
      const client = getClient();
      const resp = await client.post(
        `/debates/${flags['debate-id']}/intervention`,
        body,
      );

      const data = (resp.data ?? {}) as Record<string, unknown>;
      const filtered = filterWriteResponse(data);
      if (flags['client-request-id'])
        filtered.client_request_id = flags['client-request-id'];

      output(
        new MCPResponse({
          success: true,
          content: [new MCPContent({ type: ContentType.JSON, data: filtered })],
          metadata: { message: 'Intervention submitted' },
        }),
        flags.format,
      );
    } catch (e) {
      if (e instanceof HTTPClientError) handleServerError(e, flags.format);
      throw e;
    }
  }
}
