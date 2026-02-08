#!/usr/bin/env node

// Dev entrypoint — uses ts-node for development
async function main() {
  const { execute } = await import('@oclif/core');
  await execute({ development: true, dir: __dirname });
}

main().catch(require('@oclif/core/handle'));
