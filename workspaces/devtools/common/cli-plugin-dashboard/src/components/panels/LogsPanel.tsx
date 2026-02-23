/**
 * Logs Panel — Interactive server log viewer (server.jsonl tail).
 *
 * Features:
 * - Stable row selection (lineId-based)
 * - Pause/resume follow mode
 * - Level filtering
 * - Expandable JSON details for parsed pino logs
 * - Virtualized rendering via visible-slice-only list
 */

import { Box, Text, useInput, useStdout } from 'ink';
import React, { useEffect, useState } from 'react';

import { type LogLevel, type LogLine, type LogsData, useLogs } from '../../hooks/useLogs.js';
import { Spinner } from '../shared/Spinner.js';

interface LogsPanelProps {
  /** Max lines to keep in buffer */
  maxLines?: number;
  /** Filter by structured log service field */
  serviceName?: string;
}

type LevelFilter = 'all' | 'error' | 'warn' | 'info';
const LEVEL_FILTER_CYCLE: LevelFilter[] = ['all', 'error', 'warn', 'info'];

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function LogsPanel({ maxLines = 1000, serviceName }: LogsPanelProps) {
  const { lines, streaming, error, sourcePath }: LogsData = useLogs(
    serviceName,
    maxLines,
  );
  const { stdout } = useStdout();

  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [filterLevel, setFilterLevel] = useState<LevelFilter>('all');
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const filteredLines = lines.filter((line) => matchesLevelFilter(line, filterLevel));
  const selectedIndex = filteredLines.findIndex(
    (line) => line.lineId === selectedLineId,
  );
  const selectedLine = selectedIndex >= 0 ? filteredLines[selectedIndex] : null;

  useEffect(() => {
    if (!selectedLineId) return;
    if (!selectedLine) {
      setSelectedLineId(null);
      setDetailsExpanded(false);
    }
  }, [selectedLine, selectedLineId]);

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      if (filteredLines.length === 0) return;

      setIsPaused(true);
      setDetailsExpanded(false);
      setSelectedLineId((current) => {
        if (current === null) {
          return filteredLines[filteredLines.length - 1]?.lineId ?? null;
        }

        const currentIndex = filteredLines.findIndex(
          (line) => line.lineId === current,
        );
        if (currentIndex <= 0) return filteredLines[0]?.lineId ?? null;
        return filteredLines[currentIndex - 1]?.lineId ?? current;
      });
      return;
    }

    if (key.downArrow || input === 'j') {
      if (filteredLines.length === 0) return;

      setIsPaused(true);
      setDetailsExpanded(false);
      setSelectedLineId((current) => {
        if (current === null) {
          return filteredLines[filteredLines.length - 1]?.lineId ?? null;
        }

        const currentIndex = filteredLines.findIndex(
          (line) => line.lineId === current,
        );
        if (currentIndex < 0) {
          return filteredLines[filteredLines.length - 1]?.lineId ?? null;
        }
        if (currentIndex >= filteredLines.length - 1) {
          return filteredLines[currentIndex]?.lineId ?? null;
        }
        return filteredLines[currentIndex + 1]?.lineId ?? current;
      });
      return;
    }

    if (key.escape) {
      setIsPaused(false);
      setSelectedLineId(null);
      setDetailsExpanded(false);
      return;
    }

    if (input === ' ') {
      setIsPaused((current) => {
        const next = !current;
        if (!next) {
          setSelectedLineId(null);
          setDetailsExpanded(false);
        }
        return next;
      });
      return;
    }

    if (input === 'l' || input === 'L') {
      setFilterLevel((current) => {
        const currentIndex = LEVEL_FILTER_CYCLE.indexOf(current);
        const next =
          LEVEL_FILTER_CYCLE[(currentIndex + 1) % LEVEL_FILTER_CYCLE.length] ??
          'all';
        return next;
      });
      return;
    }

    if (key.return) {
      if (!selectedLine) return;
      setDetailsExpanded((current) => !current);
    }
  });

  const terminalRows = stdout?.rows ?? 24;
  const terminalCols = stdout?.columns ?? 80;
  const panelWidth = Math.max(48, Math.min(terminalCols - 6, 120));
  const detailsHeight = detailsExpanded && selectedLine ? 8 : 0;
  const chromeRows = 12 + detailsHeight;
  const visibleRowCount = Math.max(3, terminalRows - chromeRows);

  let listStart = 0;
  if (filteredLines.length > visibleRowCount) {
    if (!isPaused || selectedIndex < 0) {
      listStart = filteredLines.length - visibleRowCount;
    } else {
      const centerOffset = Math.floor(visibleRowCount / 2);
      const maxStart = filteredLines.length - visibleRowCount;
      listStart = Math.min(
        Math.max(0, selectedIndex - centerOffset),
        Math.max(0, maxStart),
      );
    }
  }

  const visibleLines = filteredLines.slice(listStart, listStart + visibleRowCount);
  const selectedDetails = selectedLine ? buildDetailsLines(selectedLine) : [];
  const visibleDetails =
    detailsExpanded && selectedLine
      ? selectedDetails.slice(0, Math.max(1, detailsHeight - 2))
      : [];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text bold> Logs </Text>
        <Text color={isPaused ? 'yellow' : streaming ? 'green' : 'gray'} bold>
          [{isPaused ? 'PAUSED' : streaming ? 'LIVE' : 'STOPPED'}]
        </Text>
        <Text dimColor>
          {' '}
          filter={filterLevel}  buffer={lines.length}/{maxLines}  visible=
          {filteredLines.length}
        </Text>
      </Box>

      <Box>
        <Text dimColor>{truncateText(sourcePath, panelWidth)}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          [↑↓/j/k] navigate  [Space] pause/live  [l] level  [Enter] details
          {'  '}[Esc] follow tail
        </Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">Log stream error: {error}</Text>
        </Box>
      )}

      {filteredLines.length === 0 ? (
        <Box>
          {streaming ? (
            <Spinner label="Waiting for logs..." />
          ) : (
            <Text dimColor>No logs available</Text>
          )}
        </Box>
      ) : (
        <Box flexDirection="column">
          {visibleLines.map((line) => {
            const isSelected = line.lineId === selectedLineId;
            const row = formatLogRow(line, panelWidth);

            return (
              <Box key={line.lineId}>
                <Text color={isSelected ? 'green' : 'gray'} bold={isSelected}>
                  {isSelected ? '>' : ' '}
                </Text>
                <Text>{' '}</Text>
                <Text color="gray">{row.time}</Text>
                <Text>{' '}</Text>
                <Text color={getLevelColor(line.level)} bold>
                  {row.level}
                </Text>
                <Text>{' '}</Text>
                <Text color="blue">{row.context}</Text>
                <Text>{' '}</Text>
                <Text inverse={isSelected}>{row.message}</Text>
              </Box>
            );
          })}
        </Box>
      )}

      {detailsExpanded && selectedLine && (
        <Box
          flexDirection="column"
          marginTop={1}
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
        >
          <Text bold>
            Details · {formatTimestamp(selectedLine.timestamp)} ·{' '}
            {selectedLine.level.toUpperCase()}
            {selectedLine.correlationId
              ? ` · correlationId=${selectedLine.correlationId}`
              : ''}
          </Text>
          {visibleDetails.length === 0 ? (
            <Text dimColor>(No extra structured fields)</Text>
          ) : (
            visibleDetails.map((line, index) => (
              <Text key={`${selectedLine.lineId}-${index}`}>
                {truncateText(line, panelWidth)}
              </Text>
            ))
          )}
        </Box>
      )}

      <Box marginTop={1}>
        {filteredLines.length === 0 ? (
          <Text dimColor>
            Showing 0 rows · {streaming ? 'watching file' : 'stream stopped'}
            {isPaused ? ' · paused' : ' · following tail'}
          </Text>
        ) : (
          <Text dimColor>
            Showing {visibleLines.length} rows (offset {listStart + 1}-
            {Math.min(listStart + visibleLines.length, filteredLines.length)}) of{' '}
            {filteredLines.length} filtered ·{' '}
            {streaming ? 'watching file' : 'stream stopped'}
            {isPaused ? ' · paused' : ' · following tail'}
          </Text>
        )}
      </Box>
    </Box>
  );
}

function formatLogRow(
  line: LogLine,
  panelWidth: number,
): { time: string; level: string; context: string; message: string } {
  const time = formatTimestamp(line.timestamp);
  const level = padRight(line.level.toUpperCase(), 5);
  const context = padRight(
    truncateText(line.context ?? line.service, 16),
    16,
  );

  const reservedWidth = 1 + 1 + 8 + 1 + 5 + 1 + 16 + 1;
  const messageWidth = Math.max(12, panelWidth - reservedWidth);
  const message = truncateText(line.message, messageWidth);

  return { time, level, context, message };
}

function getLevelColor(level: LogLevel): string | undefined {
  switch (level) {
    case 'fatal':
    case 'error':
      return 'red';
    case 'warn':
      return 'yellow';
    case 'info':
      return 'cyan';
    case 'debug':
      return 'gray';
    case 'trace':
      return 'magenta';
    default:
      return undefined;
  }
}

function buildDetailsLines(line: LogLine): string[] {
  if (!line.parsed) {
    return [line.raw];
  }

  const hiddenKeys = new Set([
    'level',
    'time',
    'msg',
    'message',
    'service',
    'context',
    'correlationId',
  ]);

  const details: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(line.parsed)) {
    if (!hiddenKeys.has(key)) {
      details[key] = value;
    }
  }

  if (Object.keys(details).length === 0) {
    return [];
  }

  return JSON.stringify(details, null, 2).split('\n');
}

function matchesLevelFilter(line: LogLine, filter: LevelFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'error') return line.level === 'error' || line.level === 'fatal';
  return line.level === filter;
}

function truncateText(value: string, width: number): string {
  if (width <= 0) return '';
  if (value.length <= width) return value;
  if (width <= 3) return value.slice(0, width);
  return `${value.slice(0, width - 3)}...`;
}

function padRight(value: string, width: number): string {
  if (value.length >= width) return value.slice(0, width);
  return value + ' '.repeat(width - value.length);
}
