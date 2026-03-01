import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';
import { createReadStream, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';

const LOGS_DIR = join(homedir(), '.aweave', 'logs');

/**
 * Find the most recent server pino log file matching `server.{date}.{count}.jsonl`.
 * Returns null if no matching file exists.
 */
function findLatestServerLog(): string | null {
  try {
    const files = readdirSync(LOGS_DIR)
      .filter((f) => /^server\.\d{4}-\d{2}-\d{2}\.\d+\.jsonl$/.test(f))
      .sort()
      .reverse();
    return files.length > 0 ? join(LOGS_DIR, files[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Read the last N lines from a file.
 */
function readTail(filePath: string, lines: number): Promise<string> {
  return new Promise((resolve) => {
    const allLines: string[] = [];
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      allLines.push(line);
      if (allLines.length > lines) allLines.shift();
    });

    rl.on('close', () => resolve(allLines.join('\n')));
    rl.on('error', () => resolve('(error reading log file)'));
  });
}

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

    const logPath = findLatestServerLog();
    const logContent = logPath
      ? await readTail(logPath, flags.lines)
      : '(no server log file found)';

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: {
              log_file: logPath ?? '(none)',
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
