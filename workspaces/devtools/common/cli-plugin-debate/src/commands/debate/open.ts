import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';
import { execSync } from 'child_process';

import { DEBATE_SERVER_URL } from '../../lib/config';
import { ensureServices, getServicesStatus } from '../../lib/services';

function getBaseUrl(): string {
  try {
    const url = new URL(DEBATE_SERVER_URL);
    return url.origin;
  } catch {
    return 'http://127.0.0.1:3456';
  }
}

function tryOpenBrowser(url: string): boolean {
  try {
    if (process.platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore', shell: 'cmd.exe' });
      return true;
    }
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    execSync(`${cmd} "${url}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export class DebateOpen extends Command {
  static description = 'Open debate web UI in browser';

  static flags = {
    'debate-id': Flags.string({
      description: 'Open a specific debate in the UI',
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DebateOpen);

    const ensureResp = await ensureServices();
    if (!ensureResp.success) {
      output(ensureResp, flags.format);
      this.exit(3);
    }

    const baseUrl = getBaseUrl();
    const url = flags['debate-id']
      ? `${baseUrl}/debate/debates/${flags['debate-id']}`
      : `${baseUrl}/debate`;

    const opened = tryOpenBrowser(url);
    const services = await getServicesStatus();

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: {
              url,
              opened,
              services,
            },
          }),
        ],
      }),
      flags.format,
    );
  }
}
