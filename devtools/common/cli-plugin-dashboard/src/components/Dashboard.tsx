/**
 * Root Dashboard component.
 *
 * Composes Header + TabBar + active panel.
 * Handles keyboard input for tab switching, quit, and refresh.
 *
 * Ink v6 features used:
 * - useInput: keyboard handling
 * - useApp: exit on 'q'
 * - useStdout: terminal width for responsive layout
 * - Box/Text: layout primitives
 */

import { Box, Newline, Text, useApp, useInput, useStdout } from 'ink';
import React, { useState } from 'react';

import { Header } from './Header.js';
import { LogsPanel } from './panels/LogsPanel.js';
import { ServicesPanel } from './panels/ServicesPanel.js';
import { SystemPanel } from './panels/SystemPanel.js';
import { WorkspacePanel } from './panels/WorkspacePanel.js';
import { TabBar, TABS, type TabId } from './TabBar.js';

interface DashboardProps {
  /** Refresh interval in seconds (default: 5) */
  refreshInterval?: number;
  /** Initial tab to show */
  initialTab?: TabId;
}

export function Dashboard({
  refreshInterval = 5,
  initialTab = 'services',
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const { exit } = useApp();
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;

  useInput((input, key) => {
    // Quit
    if (input === 'q') {
      exit();
      return;
    }

    // Force refresh (re-mount active panel by toggling key)
    if (input === 'r') {
      // Force re-render by cycling tab
      const current = activeTab;
      setActiveTab('services');
      setTimeout(() => setActiveTab(current), 0);
      return;
    }

    // Number keys for direct tab switch
    if (input >= '1' && input <= '4') {
      const idx = parseInt(input, 10) - 1;
      if (idx < TABS.length) {
        setActiveTab(TABS[idx].id);
      }
      return;
    }

    // Tab key cycles through tabs
    if (key.tab) {
      const currentIdx = TABS.findIndex((t) => t.id === activeTab);
      const nextIdx = (currentIdx + 1) % TABS.length;
      setActiveTab(TABS[nextIdx].id);
    }
  });

  const intervalMs = refreshInterval * 1000;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      width={Math.min(width, 80)}
    >
      <Header />
      <Newline />
      <TabBar activeTab={activeTab} />
      <Box paddingX={1}>
        <Text dimColor>{'─'.repeat(Math.min(width - 4, 76))}</Text>
      </Box>
      <Newline />

      {/* Active panel */}
      {activeTab === 'services' && (
        <ServicesPanel refreshInterval={intervalMs} />
      )}
      {activeTab === 'system' && <SystemPanel />}
      {activeTab === 'workspace' && <WorkspacePanel />}
      {activeTab === 'logs' && <LogsPanel />}

      <Newline />

      {/* Footer: keyboard hints */}
      <Box paddingX={1}>
        <Text dimColor>
          [Tab] switch  [1-4] jump  [r] refresh  [q] quit
        </Text>
      </Box>
    </Box>
  );
}
