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

import { filterWriteResponse, getClient } from '../../lib/helpers';

export class DebateRuling extends Command {
  static description = 'Submit a RULING as Arbitrator (DEV-ONLY)';

  static flags = {
    'debate-id': Flags.string({ required: true, description: 'Debate UUID' }),
    file: Flags.string({ description: 'Path to content file' }),
    content: Flags.string({ description: 'Inline content' }),
    stdin: Flags.boolean({ description: 'Read content from stdin' }),
    close: Flags.boolean({ description: 'Close debate after ruling' }),
    'client-request-id': Flags.string({ description: 'Idempotency key' }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DebateRuling);

    const result = await readContent({
      file: flags.file,
      content: flags.content,
      stdin: flags.stdin,
    });
    if (result.error) {
      output(result.error, flags.format);
      this.exit(4);
    }

    const body: Record<string, unknown> = { content: result.content };
    if (flags.close) body.close = true;
    if (flags['client-request-id'])
      body.client_request_id = flags['client-request-id'];

    try {
      const client = getClient();
      const resp = await client.post(
        `/debates/${flags['debate-id']}/ruling`,
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
          metadata: {
            message: 'Ruling submitted',
            closed: flags.close ?? false,
          },
        }),
        flags.format,
      );
    } catch (e) {
      if (e instanceof HTTPClientError) handleServerError(e, flags.format);
      throw e;
    }
  }
}
