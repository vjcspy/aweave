/**
 * Keyboard navigation hook for the stage/task tree.
 *
 * Manages cursor position in a flat list of navigable items.
 * ↑↓ move cursor, Enter selects task, Esc deselects.
 */

import { useInput } from 'ink';
import { useCallback, useState } from 'react';

import type { NavItem } from '../components/StageTree.js';

interface UseNavigationOptions {
  navItems: NavItem[];
  onSelect: (item: NavItem) => void;
  onDeselect: () => void;
  onAbort: () => void;
  onQuit: () => void;
  /** Whether human input is active (disables navigation) */
  inputActive: boolean;
}

interface UseNavigationResult {
  cursorIndex: number;
}

export function useNavigation({
  navItems,
  onSelect,
  onDeselect,
  onAbort,
  onQuit,
  inputActive,
}: UseNavigationOptions): UseNavigationResult {
  const [cursorIndex, setCursorIndex] = useState(0);

  const handleInput = useCallback(
    (
      input: string,
      key: {
        upArrow: boolean;
        downArrow: boolean;
        return: boolean;
        escape: boolean;
      },
    ) => {
      // Disable navigation when human input is active
      if (inputActive) return;

      if (key.upArrow) {
        setCursorIndex((prev) => (prev > 0 ? prev - 1 : navItems.length - 1));
        return;
      }

      if (key.downArrow) {
        setCursorIndex((prev) => (prev < navItems.length - 1 ? prev + 1 : 0));
        return;
      }

      if (key.return && navItems[cursorIndex]) {
        onSelect(navItems[cursorIndex]);
        return;
      }

      if (key.escape) {
        onDeselect();
        return;
      }

      // Number keys — jump to stage N
      if (input >= '1' && input <= '9') {
        const stageNum = parseInt(input, 10);
        const stageIdx = navItems.findIndex(
          (item) => item.type === 'stage' && item.stageIndex === stageNum - 1,
        );
        if (stageIdx >= 0) {
          setCursorIndex(stageIdx);
        }
        return;
      }

      if (input === 'a') {
        onAbort();
        return;
      }

      if (input === 'q') {
        onQuit();
        return;
      }
    },
    [navItems, cursorIndex, onSelect, onDeselect, onAbort, onQuit, inputActive],
  );

  useInput(handleInput);

  return { cursorIndex };
}
