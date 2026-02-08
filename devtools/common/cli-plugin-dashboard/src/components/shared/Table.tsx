/**
 * Simple table component using Ink Box grid layout.
 *
 * Custom implementation — avoids ink-table which has peer dep
 * conflict with Ink v6.
 */

import { Box, Text } from 'ink';
import React from 'react';

export interface Column {
  /** Column header label */
  label: string;
  /** Key to access row data */
  key: string;
  /** Fixed width in characters (optional — auto-size if omitted) */
  width?: number;
  /** Text alignment (default: left) */
  align?: 'left' | 'right';
}

export interface TableProps {
  columns: Column[];
  rows: Record<string, React.ReactNode>[];
  /** Max width for the table (truncates if needed) */
  maxWidth?: number;
}

export function Table({ columns, rows }: TableProps) {
  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        {columns.map((col) => (
          <Box key={col.key} width={col.width ?? 16}>
            <Text bold dimColor>
              {col.label}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Data rows */}
      {rows.map((row, idx) => (
        <Box key={idx}>
          {columns.map((col) => (
            <Box key={col.key} width={col.width ?? 16}>
              {typeof row[col.key] === 'string' || typeof row[col.key] === 'number' ? (
                <Text>{String(row[col.key])}</Text>
              ) : (
                (row[col.key] as React.ReactElement)
              )}
            </Box>
          ))}
        </Box>
      ))}

      {/* Empty state */}
      {rows.length === 0 && (
        <Box>
          <Text dimColor>  No data available</Text>
        </Box>
      )}
    </Box>
  );
}
