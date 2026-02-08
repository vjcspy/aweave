import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';

import * as db from '../../lib/db';
import { validateFormatNoPlain } from '../../lib/helpers';

export class DocsList extends Command {
  static description = 'List all documents (latest version each)';

  static flags = {
    limit: Flags.integer({ description: 'Max documents' }),
    'include-deleted': Flags.boolean({
      description: 'Include soft-deleted documents',
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DocsList);

    const fmtErr = validateFormatNoPlain(flags.format, 'list');
    if (fmtErr) {
      output(fmtErr, 'json');
      this.exit(4);
    }

    const [documents, total] = db.listDocuments(
      flags.limit,
      flags['include-deleted'],
    );

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({ type: ContentType.JSON, data: { documents } }),
        ],
        totalCount: total,
        hasMore: flags.limit !== undefined && documents.length < total,
      }),
      flags.format,
    );
  }
}
