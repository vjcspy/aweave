/**
 * Main panel — right side of the dashboard.
 *
 * Modes:
 * - live:         Rolling log entries + streaming from active task
 * - task-detail:  Selected task's output.detail or streamBuffer
 * - human-input:  Prompt + option list or text input
 * - summary:      Final summary when workflow completes
 */

import type {
  HumanInputConfig,
  LogEntry,
  StageState,
  WorkflowStatus,
} from '@hod/aweave-workflow-engine';
import { Box, Text } from 'ink';

import { HumanInputPanel } from './HumanInputPanel.js';

interface MainPanelProps {
  status: WorkflowStatus;
  stages: StageState[];
  logs: LogEntry[];
  selectedTask: { stageId: string; taskId: string } | null;
  humanInput: (HumanInputConfig & { stageId: string; taskId: string }) | null;
  error?: string;
  onHumanInput: (value: string) => void;
}

const LOG_COLORS: Record<string, string | undefined> = {
  info: undefined,
  warn: 'yellow',
  error: 'red',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function MainPanel({
  status,
  stages,
  logs,
  selectedTask,
  humanInput,
  error,
  onHumanInput,
}: MainPanelProps) {
  // Mode: human-input
  if (humanInput) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingLeft={1}>
        <HumanInputPanel config={humanInput} onSubmit={onHumanInput} />
      </Box>
    );
  }

  // Mode: task-detail (user selected a task)
  if (selectedTask) {
    const stage = stages.find((s) => s.definition.id === selectedTask.stageId);
    const task = stage?.tasks.find(
      (t) => t.definition.id === selectedTask.taskId,
    );

    if (task) {
      const hasDetail = !!task.output?.detail;
      const hasStream = !!task.streamBuffer;
      const hasLogs = task.logs.length > 0;
      const hasError = !!task.error;
      const durationStr = task.duration
        ? `${(task.duration / 1000).toFixed(1)}s`
        : '';

      return (
        <Box flexDirection="column" flexGrow={1} paddingLeft={1}>
          {/* Header */}
          <Box marginBottom={1}>
            <Text bold color="cyan">
              {task.definition.name}
            </Text>
            {task.output?.summary && (
              <Text dimColor> — {task.output.summary}</Text>
            )}
          </Box>

          {/* Status line */}
          <Text>
            <Text
              color={
                task.status === 'success'
                  ? 'green'
                  : task.status === 'failed' || task.status === 'error'
                    ? 'red'
                    : task.status === 'cancelled'
                      ? 'gray'
                      : 'cyan'
              }
            >
              {task.status.toUpperCase()}
            </Text>
            {durationStr && <Text dimColor> ({durationStr})</Text>}
          </Text>

          {/* Error */}
          {hasError && (
            <Box marginTop={1}>
              <Text color="red">Error: {task.error}</Text>
            </Box>
          )}

          {/* Output detail */}
          {hasDetail && (
            <Box flexDirection="column" marginTop={1}>
              <Text dimColor>── Output ──</Text>
              <Text>{task.output!.detail}</Text>
            </Box>
          )}

          {/* Stream buffer */}
          {hasStream && !hasDetail && (
            <Box flexDirection="column" marginTop={1}>
              <Text dimColor>── Stream ──</Text>
              <Text>{task.streamBuffer}</Text>
            </Box>
          )}

          {/* Task logs */}
          {hasLogs && (
            <Box flexDirection="column" marginTop={1}>
              <Text dimColor>── Logs ({task.logs.length}) ──</Text>
              {task.logs.map((log, i) => (
                <Text key={i}>
                  <Text dimColor>{formatTime(log.timestamp)}</Text>{' '}
                  <Text color={LOG_COLORS[log.level]}>
                    [{log.level.toUpperCase()}]
                  </Text>{' '}
                  <Text>{log.message}</Text>
                </Text>
              ))}
            </Box>
          )}

          {!hasDetail && !hasStream && !hasLogs && !hasError && (
            <Text dimColor>(no detail available)</Text>
          )}

          <Box marginTop={1}>
            <Text dimColor>
              [Esc] back to{' '}
              {status === 'completed' || status === 'failed'
                ? 'summary'
                : 'live view'}
            </Text>
          </Box>
        </Box>
      );
    }
  }

  // Mode: summary (workflow completed)
  if (status === 'completed') {
    return (
      <Box flexDirection="column" flexGrow={1} paddingLeft={1}>
        <Box marginBottom={1}>
          <Text bold color="green">
            ✅ Workflow Completed
          </Text>
        </Box>
        {stages.map((stage) => (
          <Text key={stage.definition.id}>
            <Text
              color={
                stage.status === 'success'
                  ? 'green'
                  : stage.status === 'skipped'
                    ? 'gray'
                    : 'red'
              }
            >
              {stage.status === 'success'
                ? '✅'
                : stage.status === 'skipped'
                  ? '⏭'
                  : '❌'}
            </Text>{' '}
            <Text>{stage.definition.name}</Text>
            <Text dimColor>
              {' '}
              — {stage.status}
              {stage.completedAt && stage.startedAt
                ? ` (${((stage.completedAt - stage.startedAt) / 1000).toFixed(1)}s)`
                : ''}
            </Text>
          </Text>
        ))}
        <Box marginTop={1}>
          <Text dimColor>[↑↓] navigate [Enter] view task detail [q] quit</Text>
        </Box>
      </Box>
    );
  }

  // Mode: failed
  if (status === 'failed') {
    return (
      <Box flexDirection="column" flexGrow={1} paddingLeft={1}>
        <Box marginBottom={1}>
          <Text bold color="red">
            ❌ Workflow Failed
          </Text>
        </Box>
        {error && <Text color="red">{error}</Text>}
        <Box marginTop={1}>
          <RecentLogs logs={logs} limit={15} />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[q] quit</Text>
        </Box>
      </Box>
    );
  }

  // Mode: live (default — rolling logs + active streaming)
  const activeStream = findActiveStream(stages);

  return (
    <Box flexDirection="column" flexGrow={1} paddingLeft={1}>
      <Box marginBottom={1}>
        <Text bold> Live</Text>
      </Box>

      {/* Recent logs */}
      <RecentLogs logs={logs} limit={10} />

      {/* Active streaming output */}
      {activeStream && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>── {activeStream.taskName} ──</Text>
          <Text>{activeStream.buffer.slice(-500)}</Text>
        </Box>
      )}

      {logs.length === 0 && !activeStream && (
        <Text dimColor>Waiting for output...</Text>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function RecentLogs({ logs, limit }: { logs: LogEntry[]; limit: number }) {
  const recent = logs.slice(-limit);
  return (
    <Box flexDirection="column">
      {recent.map((log, i) => (
        <Text key={i}>
          <Text dimColor>{formatTime(log.timestamp)}</Text>{' '}
          <Text color={LOG_COLORS[log.level]}>[{log.level.toUpperCase()}]</Text>{' '}
          <Text>{log.message}</Text>
        </Text>
      ))}
    </Box>
  );
}

function findActiveStream(
  stages: StageState[],
): { taskName: string; buffer: string } | null {
  for (const stage of stages) {
    for (const task of stage.tasks) {
      if (task.status === 'running' && task.streamBuffer) {
        return { taskName: task.definition.name, buffer: task.streamBuffer };
      }
    }
  }
  return null;
}
