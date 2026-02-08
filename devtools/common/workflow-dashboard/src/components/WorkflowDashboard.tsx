/**
 * Root workflow dashboard component.
 *
 * Layout:
 * ┌─ Workflow Name ──────── STATUS ─── 00:01:23 ─────────┐
 * │ ┌─ Stages ──────────┐ ┌─ Main Panel ────────────────┐│
 * │ │ (stage/task tree)  │ │ (logs / detail / input)     ││
 * │ └────────────────────┘ └─────────────────────────────┘│
 * │ [↑↓] navigate  [Enter] select  [Esc] live  [q] quit  │
 * └───────────────────────────────────────────────────────┘
 *
 * Subscribes to xstate actor via @xstate/react useSelector.
 *
 * NOTE: selectedTask is React state (not xstate context) because
 * xstate final states (completed/failed/aborted) don't process events.
 * Navigation must work even after the workflow finishes.
 */

import type { WorkflowActor, WorkflowState } from '@aweave/workflow-engine';
import { useSelector } from '@xstate/react';
import { Box, Text, useApp, useStdout } from 'ink';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation } from '../hooks/useNavigation.js';
import { ElapsedTime } from './ElapsedTime.js';
import { MainPanel } from './MainPanel.js';
import { buildNavItems } from './StageTree.js';
import { StageTree } from './StageTree.js';

interface WorkflowDashboardProps {
  actor: WorkflowActor;
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'gray',
  running: 'cyan',
  paused: 'yellow',
  completed: 'green',
  failed: 'red',
  aborted: 'red',
};

const selectContext = (snapshot: { context: WorkflowState }) =>
  snapshot.context;

export function WorkflowDashboard({ actor }: WorkflowDashboardProps) {
  const ctx = useSelector(actor, selectContext);
  const { exit } = useApp();
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 120;

  // Selection state lives in React — works even after workflow completes
  const [selectedTask, setSelectedTask] = useState<{
    stageId: string;
    taskId: string;
  } | null>(null);

  const navItems = useMemo(() => buildNavItems(ctx.stages), [ctx.stages]);

  const handleSelect = useCallback((item: (typeof navItems)[number]) => {
    if (item.type === 'task' && item.taskId) {
      setSelectedTask({ stageId: item.stageId, taskId: item.taskId });
    }
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const handleAbort = useCallback(() => {
    actor.send({ type: 'ABORT' });
  }, [actor]);

  const handleQuit = useCallback(() => {
    exit();
  }, [exit]);

  const handleHumanInput = useCallback(
    (value: string) => {
      actor.send({ type: 'HUMAN_INPUT', value });
    },
    [actor],
  );

  const { cursorIndex } = useNavigation({
    navItems,
    onSelect: handleSelect,
    onDeselect: handleDeselect,
    onAbort: handleAbort,
    onQuit: handleQuit,
    inputActive: ctx.humanInput !== null,
  });

  const statusColor = STATUS_COLORS[ctx.status] ?? 'white';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      width={width}
    >
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text bold>{ctx.definition.name}</Text>
        <Box>
          <Text color={statusColor} bold>
            {ctx.status.toUpperCase()}
          </Text>
          <Text> ─ </Text>
          <ElapsedTime
            startedAt={ctx.startedAt}
            completedAt={ctx.completedAt}
          />
        </Box>
      </Box>

      {/* Body: Sidebar + Main Panel */}
      <Box flexGrow={1} paddingX={1}>
        {/* Left sidebar */}
        <StageTree
          stages={ctx.stages}
          cursorIndex={cursorIndex}
          selectedTask={selectedTask}
        />

        {/* Separator */}
        <Box flexDirection="column" marginX={1}>
          <Text dimColor>│</Text>
        </Box>

        {/* Right main panel */}
        <MainPanel
          status={ctx.status}
          stages={ctx.stages}
          logs={ctx.logs}
          selectedTask={selectedTask}
          humanInput={ctx.humanInput}
          error={ctx.error}
          onHumanInput={handleHumanInput}
        />
      </Box>

      {/* Footer */}
      <Box paddingX={1}>
        <Text dimColor>
          [↑↓] navigate [Enter] select [Esc] back [1-9] jump stage [a] abort [q]
          quit
        </Text>
      </Box>
    </Box>
  );
}
