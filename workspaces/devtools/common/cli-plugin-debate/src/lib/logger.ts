import { createLogger } from '@hod/aweave-cli-shared';

export const log: ReturnType<typeof createLogger> = createLogger({
  name: 'cli-plugin-debate',
  sync: true,
  console: false,
});
