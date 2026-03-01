import { createLogger } from '@hod/aweave-cli-shared';

export const log: ReturnType<typeof createLogger> = createLogger({
  name: 'cli-plugin-relay',
  sync: true,
  console: false,
});
