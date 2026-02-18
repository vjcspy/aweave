/**
 * Live elapsed timer — updates every second.
 */

import { Text } from 'ink';
import { useEffect, useState } from 'react';

interface ElapsedTimeProps {
  startedAt?: number;
  completedAt?: number;
  color?: string;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function ElapsedTime({
  startedAt,
  completedAt,
  color = 'gray',
}: ElapsedTimeProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (completedAt || !startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt, completedAt]);

  if (!startedAt) return <Text color="gray">--:--</Text>;

  const elapsed = (completedAt ?? now) - startedAt;
  return <Text color={color}>{formatElapsed(elapsed)}</Text>;
}
