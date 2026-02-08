/**
 * Colored status indicator: ● online / ✗ offline / ◌ loading
 *
 * ASCII fallback: [OK] / [FAIL] / [...]
 */

import { Text } from 'ink';

type Status = 'online' | 'offline' | 'loading' | 'unknown';

interface StatusBadgeProps {
  status: Status;
  /** Optional label after the badge (default: shows status name) */
  label?: string;
  /** Use ASCII fallback */
  ascii?: boolean;
}

const BADGE_CONFIG: Record<Status, { icon: string; asciiIcon: string; color: string }> = {
  online: { icon: '●', asciiIcon: '[OK]', color: 'green' },
  offline: { icon: '✗', asciiIcon: '[FAIL]', color: 'red' },
  loading: { icon: '◌', asciiIcon: '[...]', color: 'yellow' },
  unknown: { icon: '?', asciiIcon: '[?]', color: 'gray' },
};

export function StatusBadge({ status, label, ascii = false }: StatusBadgeProps) {
  const config = BADGE_CONFIG[status];
  const icon = ascii ? config.asciiIcon : config.icon;
  const text = label ?? status;

  return (
    <Text>
      <Text color={config.color}>{icon}</Text>
      <Text> {text}</Text>
    </Text>
  );
}
