import {
  ContentType,
  getLogFilePath,
  MCPContent,
  MCPResponse,
  output,
  readLogTail,
} from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';

export class ServerLogs extends Command {
  static description = 'Show aweave server logs';

  static flags = {
    lines: Flags.integer({
      char: 'n',
      description: 'Number of lines to show',
      default: 50,
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(ServerLogs);

    const logContent = await readLogTail(flags.lines);
    const logPath = getLogFilePath();

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: {
              log_file: logPath,
              lines: flags.lines,
              content: logContent,
            },
          }),
        ],
      }),
      flags.format,
    );
  }
}
