import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';
import { randomUUID } from 'crypto';

export class DebateGenerateId extends Command {
  static description = 'Generate a new UUID for debate operations';

  static flags = {
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DebateGenerateId);
    const id = randomUUID();
    output(
      new MCPResponse({
        success: true,
        content: [new MCPContent({ type: ContentType.JSON, data: { id } })],
        metadata: { message: 'Use this ID for debate_id or client_request_id' },
      }),
      flags.format,
    );
  }
}
