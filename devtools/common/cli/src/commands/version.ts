import { Command } from '@oclif/core';

export class Version extends Command {
  static description = 'Show aw CLI version';

  async run() {
    this.log('aw version 0.1.0');
  }
}
