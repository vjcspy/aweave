import { useRef, useState } from 'react';
import { ImperativePanelHandle } from 'react-resizable-panels';
import { Outlet } from 'react-router';

import { Sidebar } from '@/components/layout/sidebar';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';

/**
 * Debates layout — sidebar + main content area.
 * Nested routes render inside <Outlet />.
 */
export function DebatesLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);

  const toggleSidebar = () => {
    if (sidebarPanelRef.current) {
      if (isCollapsed) {
        sidebarPanelRef.current.expand();
      } else {
        sidebarPanelRef.current.collapse();
      }
    }
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-screen w-full items-stretch"
    >
      <ResizablePanel
        ref={sidebarPanelRef}
        defaultSize="240px"
        collapsedSize="64px"
        collapsible={true}
        minSize="200px"
        maxSize="600px"
        onResize={(size) => {
          setIsCollapsed(size.inPixels < 100);
        }}
        className={cn(
          'flex',
          isCollapsed && 'transition-all duration-300 ease-in-out'
        )}
      >
        <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="100%">
        <main className="flex h-full w-full flex-col overflow-hidden">
          <Outlet />
        </main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
