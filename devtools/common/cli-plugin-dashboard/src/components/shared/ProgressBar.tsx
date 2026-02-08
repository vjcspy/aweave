/**
 * Terminal progress bar: ████░░░░ 65%
 *
 * Renders a filled/empty block bar with percentage label.
 * ASCII fallback uses [====----] for terminals without Unicode.
 */

import { Text } from 'ink';

interface ProgressBarProps {
  /** Value between 0 and 100 */
  value: number;
  /** Total width in characters (default: 20) */
  width?: number;
  /** Label shown before the bar */
  label?: string;
  /** Bar color (default: green) */
  color?: string;
  /** Use ASCII fallback */
  ascii?: boolean;
}

export function ProgressBar({
  value,
  width = 20,
  label,
  color = 'green',
  ascii = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;

  const filledChar = ascii ? '=' : '█';
  const emptyChar = ascii ? '-' : '░';

  const bar = filledChar.repeat(filled) + emptyChar.repeat(empty);
  const pct = `${Math.round(clamped)}%`.padStart(4);

  return (
    <Text>
      {label ? <Text>{label.padEnd(6)}</Text> : null}
      <Text color={color}>{bar}</Text>
      <Text> {pct}</Text>
    </Text>
  );
}
