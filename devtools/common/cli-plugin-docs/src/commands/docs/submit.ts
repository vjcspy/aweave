import {
  ContentType,
  errorResponse,
  MCPContent,
  MCPResponse,
  output,
  readContent,
} from '@aweave/cli-shared';
import { Args, Command, Flags } from '@oclif/core';

import * as db from '../../lib/db';
import { parseMetadata, validateFormatNoPlain } from '../../lib/helpers';

export class DocsSubmit extends Command {
  static description = 'Submit a new version of existing document';

  static args = {
    document_id: Args.string({
      required: true,
      description: 'Document ID to update',
    }),
  };

  static flags = {
    summary: Flags.string({ required: true, description: 'Version summary' }),
    file: Flags.string({ description: 'Path to content file' }),
    content: Flags.string({ description: 'Inline content' }),
    stdin: Flags.boolean({ description: 'Read content from stdin' }),
    metadata: Flags.string({
      default: '{}',
      description: 'JSON metadata object',
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { args, flags } = await this.parse(DocsSubmit);

    const fmtErr = validateFormatNoPlain(flags.format, 'submit');
    if (fmtErr) {
      output(fmtErr, 'json');
      this.exit(4);
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

    const [meta, metaErr] = parseMetadata(flags.metadata);
    if (metaErr) {
      output(metaErr, flags.format);
      this.exit(4);
    }

    try {
      const doc = db.submitVersion(
        args.document_id,
        flags.summary,
        result.content!,
        meta!,
      );
      if (!doc) {
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
              data: doc as unknown as Record<string, unknown>,
            }),
          ],
          metadata: {
            message: `Version ${doc.version} submitted successfully`,
          },
        }),
        flags.format,
      );
    } catch (e) {
      output(errorResponse('DB_ERROR', (e as Error).message), flags.format);
      this.exit(3);
    }
  }
}
