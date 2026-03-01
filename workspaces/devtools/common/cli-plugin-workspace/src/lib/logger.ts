import { createLogger } from '@hod/aweave-cli-shared';

export const log: ReturnType<typeof createLogger> = createLogger({
  name: 'cli-plugin-workspace',
  sync: true,
  console: false,
});
