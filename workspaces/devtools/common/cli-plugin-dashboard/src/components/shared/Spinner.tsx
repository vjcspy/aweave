/**
 * Animated spinner component for loading states.
 *
 * Custom implementation using Ink primitives — avoids community ink-spinner
 * which has peer dep conflict with Ink v6/React 19.
 */

import { Text } from 'ink';
import { useEffect, useState } from 'react';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const ASCII_FRAMES = ['|', '/', '-', '\\'];

interface SpinnerProps {
  /** Optional label shown after the spinner */
  label?: string;
  /** Color of the spinner character */
  color?: string;
  /** Use ASCII fallback for terminals without Unicode */
  ascii?: boolean;
  /** Frame interval in ms (default: 80) */
  interval?: number;
}

export function Spinner({
  label,
  color = 'cyan',
  ascii = false,
  interval = 80,
}: SpinnerProps) {
  const [frame, setFrame] = useState(0);
  const frames = ascii ? ASCII_FRAMES : SPINNER_FRAMES;

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, interval);
    return () => clearInterval(timer);
  }, [frames.length, interval]);

  return (
    <Text>
      <Text color={color}>{frames[frame]}</Text>
      {label ? <Text> {label}</Text> : null}
    </Text>
  );
}
