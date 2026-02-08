/**
 * Mini sparkline chart: ▁▂▃▅▇
 *
 * Normalizes data to range and renders using Unicode block characters.
 * ASCII fallback uses . _ - = #
 */

import { Text } from 'ink';

const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const ASCII_CHARS = ['.', '_', '-', '=', '#'];

interface SparklineProps {
  /** Numeric data points */
  data: number[];
  /** Max width in characters (default: data.length) */
  width?: number;
  /** Sparkline color */
  color?: string;
  /** Use ASCII fallback */
  ascii?: boolean;
}

export function Sparkline({
  data,
  width,
  color = 'cyan',
  ascii = false,
}: SparklineProps) {
  if (data.length === 0) {
    return <Text dimColor>—</Text>;
  }

  const chars = ascii ? ASCII_CHARS : SPARK_CHARS;
  const displayWidth = width ?? data.length;
  // Take only the last `displayWidth` points
  const visible = data.slice(-displayWidth);

  const min = Math.min(...visible);
  const max = Math.max(...visible);
  const range = max - min || 1;

  const line = visible
    .map((val) => {
      const normalized = (val - min) / range;
      const idx = Math.min(Math.round(normalized * (chars.length - 1)), chars.length - 1);
      return chars[idx];
    })
    .join('');

  return <Text color={color}>{line}</Text>;
}
