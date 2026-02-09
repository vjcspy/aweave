/**
 * Human input panel — renders option selection or free text input.
 *
 * Uses basic Ink useInput for keyboard handling (no external dependencies).
 */

import type { HumanInputConfig } from '@aweave/workflow-engine';
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

interface HumanInputPanelProps {
  config: HumanInputConfig & { stageId: string; taskId: string };
  onSubmit: (value: string) => void;
}

export function HumanInputPanel({ config, onSubmit }: HumanInputPanelProps) {
  if (config.options && config.options.length > 0) {
    return <OptionSelect config={config} onSubmit={onSubmit} />;
  }
  return <FreeTextInput config={config} onSubmit={onSubmit} />;
}

// ---------------------------------------------------------------------------
// Option selection
// ---------------------------------------------------------------------------

function OptionSelect({
  config,
  onSubmit,
}: {
  config: HumanInputConfig;
  onSubmit: (value: string) => void;
}) {
  const options = config.options!;
  const [cursor, setCursor] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) {
      setCursor((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow) {
      setCursor((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      onSubmit(options[cursor].value);
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="yellow" bold>
          ⏸ {config.prompt}
        </Text>
      </Box>
      {options.map((opt, i) => (
        <Text key={opt.value}>
          <Text color={i === cursor ? 'cyan' : undefined}>
            {i === cursor ? '❯' : ' '} {opt.label}
          </Text>
        </Text>
      ))}
      <Box marginTop={1}>
        <Text dimColor>[↑↓] select [Enter] confirm</Text>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Free text input
// ---------------------------------------------------------------------------

function FreeTextInput({
  config,
  onSubmit,
}: {
  config: HumanInputConfig;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(config.defaultValue ?? '');

  useInput((input, key) => {
    if (key.return) {
      onSubmit(value || config.defaultValue || '');
      return;
    }
    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }
    // Only accept printable characters
    if (input && !key.ctrl && !key.meta) {
      setValue((prev) => prev + input);
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="yellow" bold>
          ⏸ {config.prompt}
        </Text>
      </Box>
      <Box>
        <Text color="cyan">❯ </Text>
        <Text>{value}</Text>
        <Text color="gray">█</Text>
      </Box>
      {config.defaultValue && (
        <Box marginTop={1}>
          <Text dimColor>Default: {config.defaultValue}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>[Enter] submit [Backspace] delete</Text>
      </Box>
    </Box>
  );
}
