/**
 * Tab navigation bar — clickable tabs with keyboard hints.
 *
 * Active tab: bold + underline + cyan.
 * Inactive: dim.
 * Keyboard: Tab or 1-4 to switch.
 */

import { Box, Text } from 'ink';
import React from 'react';

export type TabId = 'services' | 'system' | 'workspace' | 'logs';

export interface Tab {
  id: TabId;
  label: string;
}

export const TABS: Tab[] = [
  { id: 'services', label: 'Services' },
  { id: 'system', label: 'System' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'logs', label: 'Logs' },
];

interface TabBarProps {
  activeTab: TabId;
}

export function TabBar({ activeTab }: TabBarProps) {
  return (
    <Box paddingX={1}>
      {TABS.map((tab, idx) => {
        const isActive = tab.id === activeTab;
        return (
          <Box key={tab.id} marginRight={2}>
            <Text
              bold={isActive}
              underline={isActive}
              color={isActive ? 'cyan' : undefined}
              dimColor={!isActive}
            >
              {isActive ? '▸ ' : '  '}
              {tab.label}
            </Text>
            <Text dimColor> [{idx + 1}]</Text>
          </Box>
        );
      })}
    </Box>
  );
}
