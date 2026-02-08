import {
  ContentType,
  handleServerError,
  HTTPClientError,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';

import { getClient } from '../../lib/helpers';

export class DebateList extends Command {
  static description = 'List all debates';

  static flags = {
    state: Flags.string({ description: 'Filter by state' }),
    limit: Flags.integer({ description: 'Max results' }),
    offset: Flags.integer({ description: 'Pagination offset' }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DebateList);

    try {
      const client = getClient();
      const params: Record<string, string> = {};
      if (flags.state) params.state = flags.state;
      if (flags.limit !== undefined) params.limit = String(flags.limit);
      if (flags.offset !== undefined) params.offset = String(flags.offset);

      const resp = await client.get(
        '/debates',
        Object.keys(params).length > 0 ? params : undefined,
      );
      const data = (resp.data ?? {}) as Record<string, unknown>;
      const total = (data.total as number) ?? 0;
      const debates = (data.debates as unknown[]) ?? [];

      output(
        new MCPResponse({
          success: true,
          content: [
            new MCPContent({ type: ContentType.JSON, data: { debates } }),
          ],
          totalCount: total,
          hasMore: flags.limit !== undefined && debates.length === flags.limit,
        }),
        flags.format,
      );
    } catch (e) {
      if (e instanceof HTTPClientError) handleServerError(e, flags.format);
      throw e;
    }
  }
}
