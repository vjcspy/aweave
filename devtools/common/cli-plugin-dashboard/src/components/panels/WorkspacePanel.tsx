/**
 * Workspace Panel — Package list with build status.
 *
 * Scans pnpm-workspace.yaml and checks for dist/ artifacts.
 */

import { Box, Text } from 'ink';
import React from 'react';

import { useWorkspace } from '../../hooks/useWorkspace.js';
import { Spinner } from '../shared/Spinner.js';
import { Table, type Column } from '../shared/Table.js';

const COLUMNS: Column[] = [
  { label: 'Package', key: 'name', width: 32 },
  { label: 'Path', key: 'path', width: 26 },
  { label: 'Built', key: 'built', width: 8 },
];

export function WorkspacePanel() {
  const { packages, loading, lastScan, error } = useWorkspace();

  if (loading) {
    return (
      <Box paddingX={1}>
        <Spinner label="Scanning workspace..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box paddingX={1}>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  const builtCount = packages.filter((p) => p.built).length;

  const rows = packages.map((pkg) => ({
    name: pkg.name,
    path: pkg.path.length > 24 ? pkg.path.slice(0, 21) + '...' : pkg.path,
    built: pkg.built ? (
      <Text color="green">✓</Text>
    ) : (
      <Text color="red">✗</Text>
    ),
  }));

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>
          {' '}Packages ({packages.length}){' '}
        </Text>
      </Box>

      <Table columns={COLUMNS} rows={rows} />

      <Box marginTop={1}>
        <Text dimColor>
          Summary: {builtCount}/{packages.length} built
          {lastScan && `  ·  Last scan: ${lastScan.toLocaleTimeString()}`}
        </Text>
      </Box>
    </Box>
  );
}
