/**
 * Single task row in the stage tree sidebar.
 * Shows strategy icon, status icon, task name, and optional duration.
 */

import type { ExecutionStrategy, TaskState } from '@aweave/workflow-engine';
import { Text } from 'ink';

import { Spinner } from './Spinner.js';

interface TaskRowProps {
  task: TaskState;
  strategy: ExecutionStrategy;
  isSelected: boolean;
  isCursor: boolean;
}

const STRATEGY_ICONS: Record<ExecutionStrategy, string> = {
  sequential: '→',
  parallel: '∥',
  race: '⚡',
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Text dimColor>⬜</Text>;
    case 'running':
      return <Spinner />;
    case 'success':
      return <Text color="green">✅</Text>;
    case 'failed':
    case 'error':
      return <Text color="red">❌</Text>;
    case 'cancelled':
      return <Text dimColor>⊘</Text>;
    case 'skipped':
      return <Text dimColor>⏭</Text>;
    default:
      return <Text>?</Text>;
  }
}

function formatDuration(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function TaskRow({
  task,
  strategy,
  isSelected,
  isCursor,
}: TaskRowProps) {
  const strategyIcon = STRATEGY_ICONS[strategy];
  const duration = formatDuration(task.duration);

  return (
    <Text
      backgroundColor={isCursor ? 'blue' : undefined}
      color={isSelected ? 'cyan' : undefined}
    >
      {'  '}
      <Text dimColor>{strategyIcon}</Text> <StatusIcon status={task.status} />{' '}
      <Text>{task.definition.name}</Text>
      {duration && <Text dimColor> {duration}</Text>}
    </Text>
  );
}
