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

export class DocsDelete extends Command {
  static description = 'Soft-delete document (marks all versions as deleted)';

  static args = {
    document_id: Args.string({ required: true, description: 'Document ID' }),
  };

  static flags = {
    confirm: Flags.boolean({ description: 'Confirm deletion' }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { args, flags } = await this.parse(DocsDelete);

    const fmtErr = validateFormatNoPlain(flags.format, 'delete');
    if (fmtErr) {
      output(fmtErr, 'json');
      this.exit(4);
    }

    if (!flags.confirm) {
      output(
        errorResponse(
          'INVALID_INPUT',
          'Deletion requires confirmation',
          'Add --confirm flag to proceed',
        ),
        flags.format,
      );
      this.exit(4);
    }

    const affected = db.softDeleteDocument(args.document_id);
    if (affected === 0) {
      output(
        errorResponse(
          'DOC_NOT_FOUND',
          `Document '${args.document_id}' not found or already deleted`,
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
            type: ContentType.TEXT,
            text: 'Document soft-deleted',
          }),
        ],
        metadata: {
          document_id: args.document_id,
          versions_affected: affected,
        },
      }),
      flags.format,
    );
  }
}
