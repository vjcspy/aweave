/**
 * Logs Panel — Live PM2 log stream with color-coded log levels.
 *
 * Uses streaming via long-lived spawn (not polling).
 * Static component for log history to avoid re-rendering old lines.
 * Color-coded: INFO=cyan, ERROR=red, WARN=yellow.
 */

import { Box, Static, Text, Transform } from 'ink';
import React from 'react';

import { useLogs, type LogsData } from '../../hooks/useLogs.js';
import { Spinner } from '../shared/Spinner.js';

interface LogsPanelProps {
  /** Max lines to keep in buffer */
  maxLines?: number;
  /** Filter by pm2 service name */
  serviceName?: string;
}

function getLogLevelColor(message: string): string | undefined {
  const upper = message.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('ERR')) return 'red';
  if (upper.includes('WARN')) return 'yellow';
  if (upper.includes('INFO')) return 'cyan';
  if (upper.includes('DEBUG')) return 'gray';
  return undefined;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function colorize(children: string): string {
  // Transform callback — used for coloring individual log lines
  return children;
}

export function LogsPanel({
  maxLines = 50,
  serviceName,
}: LogsPanelProps) {
  const { lines, streaming, error }: LogsData = useLogs(serviceName, maxLines);

  return (
    <Box flexDirection="column" paddingX={1}>
      {error ? (
        <Text color="red">{error}</Text>
      ) : lines.length === 0 ? (
        <Box>
          {streaming ? (
            <Spinner label="Waiting for logs..." />
          ) : (
            <Text dimColor>No logs available</Text>
          )}
        </Box>
      ) : (
        <>
          {/* Use Static for log history — doesn't re-render old lines */}
          <Static items={lines}>
            {(line, idx) => {
              const color = getLogLevelColor(line.message);
              return (
                <Box key={idx}>
                  <Transform transform={colorize}>
                    <Text>
                      <Text dimColor>{formatTimestamp(line.timestamp)}</Text>
                      {'  '}
                      <Text bold>{line.service.padEnd(16)}</Text>
                      {'  '}
                      <Text color={color}>{line.message}</Text>
                    </Text>
                  </Transform>
                </Box>
              );
            }}
          </Static>

          <Box marginTop={1}>
            <Text dimColor>
              Showing last {lines.length} lines
              {streaming ? '  ·  ' : '  ·  Disconnected'}
            </Text>
            {streaming && <Spinner label="" />}
          </Box>
        </>
      )}
    </Box>
  );
}
