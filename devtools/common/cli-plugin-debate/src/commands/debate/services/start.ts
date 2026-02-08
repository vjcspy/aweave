import { output } from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';

import { ensureServices } from '../../../lib/services';

export class DebateServicesStart extends Command {
  static description = 'Start debate services (build if needed)';

  static flags = {
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DebateServicesStart);
    const response = await ensureServices();
    output(response, flags.format);
    if (!response.success) this.exit(3);
  }
}
