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

import { AUTO_START_SERVICES } from '../../lib/config';
import { filterWriteResponse, getClient } from '../../lib/helpers';
import { ensureServices } from '../../lib/services';

export class DebateCreate extends Command {
  static description = 'Create a new debate with MOTION';

  static flags = {
    'debate-id': Flags.string({ required: true, description: 'Debate UUID' }),
    title: Flags.string({ required: true, description: 'Debate title' }),
    type: Flags.string({
      required: true,
      description: 'Debate type: coding_plan_debate|general_debate',
    }),
    file: Flags.string({ description: 'Path to motion content file' }),
    content: Flags.string({ description: 'Inline motion content' }),
    stdin: Flags.boolean({ description: 'Read motion content from stdin' }),
    'client-request-id': Flags.string({ description: 'Idempotency key' }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DebateCreate);

    if (AUTO_START_SERVICES) {
      const serviceResp = await ensureServices();
      if (!serviceResp.success) {
        output(serviceResp, flags.format);
        this.exit(3);
      }
    }

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
      const resp = await client.post('/debates', {
        debate_id: flags['debate-id'],
        title: flags.title,
        debate_type: flags.type,
        motion_content: result.content,
        client_request_id: reqId,
      });

      const data = (resp.data ?? {}) as Record<string, unknown>;
      const filtered = filterWriteResponse(data);
      filtered.client_request_id = reqId;

      output(
        new MCPResponse({
          success: true,
          content: [new MCPContent({ type: ContentType.JSON, data: filtered })],
          metadata: { message: 'Debate created successfully' },
        }),
        flags.format,
      );
    } catch (e) {
      if (e instanceof HTTPClientError) handleServerError(e, flags.format);
      throw e;
    }
  }
}
