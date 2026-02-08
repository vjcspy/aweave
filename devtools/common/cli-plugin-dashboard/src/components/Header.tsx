/**
 * Dashboard header — Title + real-time clock + version.
 *
 * Uses Spacer to push clock to the right.
 */

import { Box, Spacer, Text } from 'ink';
import React, { useEffect, useState } from 'react';

const VERSION = '0.1.0';

function formatTime(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function Header() {
  const [time, setTime] = useState(formatTime());

  useEffect(() => {
    const timer = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box paddingX={1}>
      <Text bold color="cyan">
        AWeave DevTools
      </Text>
      <Text dimColor> v{VERSION}</Text>
      <Spacer />
      <Text dimColor>{time}</Text>
    </Box>
  );
}
