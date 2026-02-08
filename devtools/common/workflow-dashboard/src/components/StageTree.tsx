/**
 * Stage/task tree sidebar — shows workflow progress hierarchy.
 *
 * Each stage shows its status and contains task rows.
 * Cursor navigation highlights the currently focused item.
 */

import type { ExecutionStrategy, StageState } from '@aweave/workflow-engine';
import { Box, Text } from 'ink';

import { Spinner } from './Spinner.js';
import { TaskRow } from './TaskRow.js';

export interface NavItem {
  type: 'stage' | 'task';
  stageIndex: number;
  stageId: string;
  taskIndex?: number;
  taskId?: string;
}

interface StageTreeProps {
  stages: StageState[];
  cursorIndex: number;
  selectedTask: { stageId: string; taskId: string } | null;
}

function StageStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Text dimColor>⬜</Text>;
    case 'running':
      return <Spinner />;
    case 'success':
      return <Text color="green">✅</Text>;
    case 'failed':
      return <Text color="red">❌</Text>;
    case 'skipped':
      return <Text dimColor>⏭</Text>;
    default:
      return <Text>?</Text>;
  }
}

export function buildNavItems(stages: StageState[]): NavItem[] {
  const items: NavItem[] = [];
  for (let si = 0; si < stages.length; si++) {
    const stage = stages[si];
    items.push({ type: 'stage', stageIndex: si, stageId: stage.definition.id });
    for (let ti = 0; ti < stage.tasks.length; ti++) {
      const task = stage.tasks[ti];
      items.push({
        type: 'task',
        stageIndex: si,
        stageId: stage.definition.id,
        taskIndex: ti,
        taskId: task.definition.id,
      });
    }
  }
  return items;
}

export function StageTree({
  stages,
  cursorIndex,
  selectedTask,
}: StageTreeProps) {
  let navIdx = 0;

  return (
    <Box flexDirection="column" width={28}>
      <Box marginBottom={1}>
        <Text bold> Stages</Text>
      </Box>
      {stages.map((stage) => {
        const stageNavIdx = navIdx;
        navIdx++;
        const isStageCursor = stageNavIdx === cursorIndex;
        const strategy = stage.definition.execution as ExecutionStrategy;

        return (
          <Box key={stage.definition.id} flexDirection="column">
            <Text backgroundColor={isStageCursor ? 'blue' : undefined}>
              {' '}
              <StageStatusIcon status={stage.status} />{' '}
              <Text bold={stage.status === 'running'}>
                {stage.definition.name}
              </Text>
            </Text>

            {stage.tasks.map((task) => {
              const taskNavIdx = navIdx;
              navIdx++;
              const isCursor = taskNavIdx === cursorIndex;
              const isSelected =
                selectedTask?.stageId === stage.definition.id &&
                selectedTask?.taskId === task.definition.id;

              return (
                <TaskRow
                  key={task.definition.id}
                  task={task}
                  strategy={strategy}
                  isSelected={isSelected}
                  isCursor={isCursor}
                />
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
