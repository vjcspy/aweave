import { createLogger } from '@hod/aweave-cli-shared';

export const log: ReturnType<typeof createLogger> = createLogger({
  name: 'test',
  sync: true,
  console: false,
});
