import {
  ContentType,
  errorResponse,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import { Args, Command, Flags } from '@oclif/core';

import * as db from '../../lib/db';
import { validateFormatNoPlain } from '../../lib/helpers';

export class DocsHistory extends Command {
  static description = 'Show version history of a document';

  static args = {
    document_id: Args.string({ required: true, description: 'Document ID' }),
  };

  static flags = {
    limit: Flags.integer({ description: 'Max versions' }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { args, flags } = await this.parse(DocsHistory);

    const fmtErr = validateFormatNoPlain(flags.format, 'history');
    if (fmtErr) {
      output(fmtErr, 'json');
      this.exit(4);
    }

    const [versions, total] = db.getHistory(args.document_id, flags.limit);

    if (total === 0) {
      output(
        errorResponse(
          'DOC_NOT_FOUND',
          `Document '${args.document_id}' not found or deleted`,
          "Use 'aw docs list' to see available documents",
        ),
        flags.format,
      );
      this.exit(2);
    }

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: { document_id: args.document_id, versions },
          }),
        ],
        totalCount: total,
        hasMore: flags.limit !== undefined && versions.length < total,
      }),
      flags.format,
    );
  }
}
