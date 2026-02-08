/**
 * Services Panel — PM2 process list + health checks.
 *
 * Displays pm2 processes in a table with status badges,
 * plus health check results with latency measurements.
 */

import { Box, Text } from 'ink';
import React from 'react';

import { useServices } from '../../hooks/useServices.js';
import { formatBytes, formatUptime } from '../../lib/pm2.js';
import { Spinner } from '../shared/Spinner.js';
import { StatusBadge } from '../shared/StatusBadge.js';
import { Table, type Column } from '../shared/Table.js';

interface ServicesPanelProps {
  refreshInterval?: number;
}

const PROCESS_COLUMNS: Column[] = [
  { label: 'Name', key: 'name', width: 20 },
  { label: 'Status', key: 'status', width: 14 },
  { label: 'CPU', key: 'cpu', width: 10 },
  { label: 'Memory', key: 'memory', width: 14 },
  { label: 'Uptime', key: 'uptime', width: 12 },
];

const HEALTH_COLUMNS: Column[] = [
  { label: 'Service', key: 'name', width: 16 },
  { label: 'URL', key: 'url', width: 30 },
  { label: 'Status', key: 'status', width: 14 },
  { label: 'Latency', key: 'latency', width: 10 },
];

export function ServicesPanel({ refreshInterval }: ServicesPanelProps) {
  const {
    processes,
    processesLoading,
    processesStale,
    processesError,
    healthResults,
    healthLoading,
    lastUpdated,
  } = useServices(refreshInterval);

  // Map pm2 processes to table rows
  const processRows = processes.map((proc) => ({
    name: proc.name,
    status: (
      <StatusBadge
        status={proc.status === 'online' ? 'online' : 'offline'}
        label={proc.status}
      />
    ),
    cpu: `${proc.cpu.toFixed(1)}%`,
    memory: formatBytes(proc.memory),
    uptime: formatUptime(proc.uptime),
  }));

  // Map health results to table rows
  const healthRows = healthResults.map((ep) => ({
    name: ep.name,
    url: ep.url,
    status: (
      <StatusBadge
        status={ep.healthy ? 'online' : 'offline'}
        label={ep.healthy ? 'healthy' : 'offline'}
      />
    ),
    latency: ep.latencyMs !== null ? `${ep.latencyMs}ms` : '—',
  }));

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* PM2 Processes */}
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>
            {' '}PM2 Processes{' '}
          </Text>
          {processesStale && (
            <Text dimColor> (stale{processesError ? `: ${processesError}` : ''})</Text>
          )}
          {processesLoading && <Spinner label="Loading..." />}
        </Box>
        <Table columns={PROCESS_COLUMNS} rows={processRows} />
      </Box>

      <Box marginY={1}>
        <Text dimColor>{'─'.repeat(60)}</Text>
      </Box>

      {/* Health Checks */}
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>
            {' '}Health Checks{' '}
          </Text>
          {healthLoading && <Spinner label="Checking..." />}
        </Box>
        <Table columns={HEALTH_COLUMNS} rows={healthRows} />
      </Box>

      {/* Refresh indicator */}
      {lastUpdated && (
        <Box marginTop={1}>
          <Text dimColor>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Text>
        </Box>
      )}
    </Box>
  );
}
