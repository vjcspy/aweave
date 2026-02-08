import {
  ContentType,
  errorResponse,
  MCPContent,
  MCPResponse,
  output,
  readContent,
} from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';

import * as db from '../../lib/db';
import { parseMetadata, validateFormatNoPlain } from '../../lib/helpers';

export class DocsCreate extends Command {
  static description = 'Create a new document (version 1)';

  static flags = {
    summary: Flags.string({ required: true, description: 'Document summary' }),
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
    const { flags } = await this.parse(DocsCreate);

    const fmtErr = validateFormatNoPlain(flags.format, 'create');
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
      const doc = db.createDocument(flags.summary, result.content!, meta!);
      output(
        new MCPResponse({
          success: true,
          content: [
            new MCPContent({
              type: ContentType.JSON,
              data: doc as unknown as Record<string, unknown>,
            }),
          ],
          metadata: { message: 'Document created successfully' },
        }),
        flags.format,
      );
    } catch (e) {
      output(errorResponse('DB_ERROR', (e as Error).message), flags.format);
      this.exit(3);
    }
  }
}
