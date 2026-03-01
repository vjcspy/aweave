import { createLogger } from '@hod/aweave-cli-shared';

export const log: ReturnType<typeof createLogger> = createLogger({
  name: 'dashboard',
  sync: true,
  console: false,
});
