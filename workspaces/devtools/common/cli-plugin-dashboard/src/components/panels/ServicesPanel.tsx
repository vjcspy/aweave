/**
 * Services Panel — Native daemon status + health checks.
 *
 * Displays the managed server daemon lifecycle status
 * plus health check results with latency measurements.
 */

import { Box, Text } from 'ink';
import React from 'react';

import { useServices } from '../../hooks/useServices.js';
import { formatUptimeMs } from '../../lib/server-daemon.js';
import { Spinner } from '../shared/Spinner.js';
import { StatusBadge } from '../shared/StatusBadge.js';
import { type Column, Table } from '../shared/Table.js';

interface ServicesPanelProps {
  refreshInterval?: number;
}

const SERVICE_COLUMNS: Column[] = [
  { label: 'Name', key: 'name', width: 20 },
  { label: 'Runtime', key: 'runtime', width: 14 },
  { label: 'Health', key: 'health', width: 14 },
  { label: 'PID', key: 'pid', width: 10 },
  { label: 'Port', key: 'port', width: 8 },
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
    services,
    servicesLoading,
    servicesStale,
    servicesError,
    healthResults,
    healthLoading,
    lastUpdated,
  } = useServices(refreshInterval);

  const serviceRows = services.map((svc) => ({
    name: svc.name,
    runtime: (
      <StatusBadge
        status={svc.runtimeStatus === 'running' ? 'online' : 'offline'}
        label={svc.runtimeStatus}
      />
    ),
    health: (
      <StatusBadge
        status={svc.healthy ? 'online' : 'offline'}
        label={svc.healthy ? 'healthy' : 'offline'}
      />
    ),
    pid: svc.pid ?? '-',
    port: svc.port ?? '-',
    uptime: formatUptimeMs(svc.uptimeMs),
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
      {/* Managed services (native daemon) */}
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold> Managed Services </Text>
          {servicesStale && (
            <Text dimColor>
              {' '}(stale{servicesError ? `: ${servicesError}` : ''})
            </Text>
          )}
          {servicesLoading && <Spinner label="Loading..." />}
        </Box>
        <Table columns={SERVICE_COLUMNS} rows={serviceRows} />
        <Box marginTop={1}>
          <Text dimColor>
            Native daemon source: ~/.aweave/server.json + process health checks
          </Text>
        </Box>
      </Box>

      <Box marginY={1}>
        <Text dimColor>{'─'.repeat(60)}</Text>
      </Box>

      {/* Health Checks */}
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold> Health Checks </Text>
          {healthLoading && <Spinner label="Checking..." />}
        </Box>
        <Table columns={HEALTH_COLUMNS} rows={healthRows} />
      </Box>

      {/* Refresh indicator */}
      {lastUpdated && (
        <Box marginTop={1}>
          <Text dimColor>Last updated: {lastUpdated.toLocaleTimeString()}</Text>
        </Box>
      )}
    </Box>
  );
}
