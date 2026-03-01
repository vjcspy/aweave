import {
  ContentType,
  errorResponse,
  getCliLogger,
  MCPContent,
  MCPResponse,
  output,
  readContent,
} from '@hod/aweave-cli-shared';
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
    const log = getCliLogger();

    log.info({ summary: flags.summary }, 'docs create: initiating');

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
      log.error({ err: result.error }, 'docs create: content read failed');
      output(result.error, flags.format);
      this.exit(4);
    }

    const [meta, metaErr] = parseMetadata(flags.metadata);
    if (metaErr) {
      log.error({ metadata: flags.metadata }, 'docs create: invalid metadata');
      output(metaErr, flags.format);
      this.exit(4);
    }

    try {
      const doc = db.createDocument(flags.summary, result.content!, meta!);
      const docData = doc as unknown as Record<string, unknown>;
      log.info({ docId: docData.id }, 'docs create: success');
      output(
        new MCPResponse({
          success: true,
          content: [
            new MCPContent({
              type: ContentType.JSON,
              data: docData,
            }),
          ],
          metadata: { message: 'Document created successfully' },
        }),
        flags.format,
      );
    } catch (e) {
      log.error({ err: e }, 'docs create: db error');
      output(errorResponse('DB_ERROR', (e as Error).message), flags.format);
      this.exit(3);
    }
  }
}
