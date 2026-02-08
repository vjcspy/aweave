import {
  ContentType,
  errorResponse,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import { Args, Command, Flags } from '@oclif/core';

import * as db from '../../lib/db';

export class DocsGet extends Command {
  static description =
    'Get document content. Use --format plain for raw content only.';

  static args = {
    document_id: Args.string({ required: true, description: 'Document ID' }),
  };

  static flags = {
    version: Flags.integer({ description: 'Specific version' }),
    format: Flags.string({
      default: 'plain',
      options: ['json', 'markdown', 'plain'],
      description: 'Output format',
    }),
  };

  async run() {
    const { args, flags } = await this.parse(DocsGet);
    const doc = db.getDocument(args.document_id, flags.version);

    if (!doc) {
      const errorFmt = flags.format === 'plain' ? 'json' : flags.format;
      const code =
        flags.version !== undefined ? 'VERSION_NOT_FOUND' : 'DOC_NOT_FOUND';
      const msg = `Document '${args.document_id}'${flags.version !== undefined ? ` version ${flags.version}` : ''} not found`;
      output(
        errorResponse(
          code,
          msg,
          "Use 'aw docs list' or 'aw docs history' to see available documents/versions",
        ),
        errorFmt,
      );
      this.exit(2);
    }

    if (flags.format === 'plain') {
      console.log(doc.content);
    } else {
      output(
        new MCPResponse({
          success: true,
          content: [
            new MCPContent({
              type: ContentType.JSON,
              data: doc as unknown as Record<string, unknown>,
            }),
          ],
        }),
        flags.format,
      );
    }
  }
}
