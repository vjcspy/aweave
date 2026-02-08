import {
  ContentType,
  handleServerError,
  HTTPClientError,
  MCPContent,
  MCPResponse,
  output,
  readContent,
} from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';
import { randomUUID } from 'crypto';

import { filterWriteResponse, getClient } from '../../lib/helpers';

export class DebateAppeal extends Command {
  static description = 'Submit an APPEAL to request Arbitrator ruling';

  static flags = {
    'debate-id': Flags.string({ required: true, description: 'Debate UUID' }),
    'target-id': Flags.string({
      required: true,
      description: 'Target argument UUID',
    }),
    file: Flags.string({ description: 'Path to content file' }),
    content: Flags.string({ description: 'Inline content' }),
    stdin: Flags.boolean({ description: 'Read content from stdin' }),
    'client-request-id': Flags.string({ description: 'Idempotency key' }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DebateAppeal);

    const result = await readContent({
      file: flags.file,
      content: flags.content,
      stdin: flags.stdin,
    });
    if (result.error) {
      output(result.error, flags.format);
      this.exit(4);
    }

    const reqId = flags['client-request-id'] ?? randomUUID();

    try {
      const client = getClient();
      const resp = await client.post(`/debates/${flags['debate-id']}/appeal`, {
        target_id: flags['target-id'],
        content: result.content,
        client_request_id: reqId,
      });

      const data = (resp.data ?? {}) as Record<string, unknown>;
      const filtered = filterWriteResponse(data);
      filtered.client_request_id = reqId;

      output(
        new MCPResponse({
          success: true,
          content: [new MCPContent({ type: ContentType.JSON, data: filtered })],
          metadata: { message: 'Appeal submitted' },
        }),
        flags.format,
      );
    } catch (e) {
      if (e instanceof HTTPClientError) handleServerError(e, flags.format);
      throw e;
    }
  }
}
