import { output } from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';

import { stopServices } from '../../../lib/services';

export class DebateServicesStop extends Command {
  static description = 'Stop debate services';

  static flags = {
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DebateServicesStop);
    const response = await stopServices();
    output(response, flags.format);
    if (!response.success) this.exit(3);
  }
}
