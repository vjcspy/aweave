import { createLogger } from '@hod/aweave-cli-shared';

export const log: ReturnType<typeof createLogger> = createLogger({
  name: 'cli-plugin-demo-workflow',
  sync: true,
  console: false,
});
