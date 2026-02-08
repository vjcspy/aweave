/**
 * System Panel — CPU, memory, disk progress bars + sparkline + versions.
 *
 * Real-time system resource monitoring with sparkline history for CPU.
 */

import { Box, Text } from 'ink';
import React from 'react';

import { useSystemInfo } from '../../hooks/useSystemInfo.js';
import { ProgressBar } from '../shared/ProgressBar.js';
import { Sparkline } from '../shared/Sparkline.js';
import { Spinner } from '../shared/Spinner.js';

export function SystemPanel() {
  const { cpu, cpuHistory, memory, disk, versions, loading } = useSystemInfo();

  if (loading) {
    return (
      <Box paddingX={1}>
        <Spinner label="Loading system info..." />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Resources */}
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold> Resources </Text>
        </Box>

        {/* CPU */}
        <Box>
          <Box width={40}>
            <ProgressBar
              label="CPU"
              value={cpu}
              width={20}
              color={cpu > 80 ? 'red' : cpu > 60 ? 'yellow' : 'green'}
            />
          </Box>
          <Box marginLeft={2}>
            <Sparkline data={cpuHistory} width={15} color="cyan" />
          </Box>
        </Box>

        {/* Memory */}
        <Box>
          <Box width={40}>
            <ProgressBar
              label="MEM"
              value={memory.percentage}
              width={20}
              color={memory.percentage > 85 ? 'red' : memory.percentage > 70 ? 'yellow' : 'green'}
            />
          </Box>
          <Box marginLeft={2}>
            <Text dimColor>
              {memory.usedFormatted} / {memory.totalFormatted}
            </Text>
          </Box>
        </Box>

        {/* Disk */}
        <Box>
          {disk ? (
            <>
              <Box width={40}>
                <ProgressBar
                  label="DISK"
                  value={disk.percentage}
                  width={20}
                  color={disk.percentage > 90 ? 'red' : disk.percentage > 75 ? 'yellow' : 'green'}
                />
              </Box>
              <Box marginLeft={2}>
                <Text dimColor>
                  {disk.used} / {disk.size}
                </Text>
              </Box>
            </>
          ) : (
            <Text dimColor>DISK   unavailable</Text>
          )}
        </Box>
      </Box>

      <Box marginY={1}>
        <Text dimColor>{'─'.repeat(60)}</Text>
      </Box>

      {/* Environment */}
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold> Environment </Text>
        </Box>
        {versions ? (
          <Box flexDirection="column" paddingLeft={2}>
            <Text>
              <Text dimColor>{'Node.js'.padEnd(12)}</Text>
              <Text>{versions.node}</Text>
            </Text>
            <Text>
              <Text dimColor>{'pnpm'.padEnd(12)}</Text>
              <Text>{versions.pnpm}</Text>
            </Text>
            <Text>
              <Text dimColor>{'OS'.padEnd(12)}</Text>
              <Text>{versions.os}</Text>
            </Text>
            <Text>
              <Text dimColor>{'Hostname'.padEnd(12)}</Text>
              <Text>{versions.hostname}</Text>
            </Text>
            <Text>
              <Text dimColor>{'Uptime'.padEnd(12)}</Text>
              <Text>{versions.uptime}</Text>
            </Text>
          </Box>
        ) : (
          <Spinner label="Loading..." />
        )}
      </Box>
    </Box>
  );
}
