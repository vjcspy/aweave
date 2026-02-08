#!/usr/bin/env node

async function main() {
  const { execute } = await import('@oclif/core');
  await execute({ dir: __dirname });
}

main().catch(require('@oclif/core/handle'));
