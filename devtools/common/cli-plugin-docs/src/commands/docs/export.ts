import {
  ContentType,
  errorResponse,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import { Args, Command, Flags } from '@oclif/core';
import { writeFileSync } from 'fs';

import * as db from '../../lib/db';
import { validateFormatNoPlain } from '../../lib/helpers';

export class DocsExport extends Command {
  static description = 'Export document content to file';

  static args = {
    document_id: Args.string({ required: true, description: 'Document ID' }),
  };

  static flags = {
    output: Flags.string({
      required: true,
      char: 'o',
      description: 'Output file path',
    }),
    version: Flags.integer({ description: 'Specific version' }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { args, flags } = await this.parse(DocsExport);

    const fmtErr = validateFormatNoPlain(flags.format, 'export');
    if (fmtErr) {
      output(fmtErr, 'json');
      this.exit(4);
    }

    const doc = db.getDocument(args.document_id, flags.version);
    if (!doc) {
      output(
        errorResponse(
          'DOC_NOT_FOUND',
          `Document '${args.document_id}' not found`,
          "Use 'aw docs list' to see available documents",
        ),
        flags.format,
      );
      this.exit(2);
    }

    writeFileSync(flags.output, doc.content, 'utf-8');

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.TEXT,
            text: `Exported to ${flags.output}`,
          }),
        ],
        metadata: { path: flags.output, version: doc.version },
      }),
      flags.format,
    );
  }
}
