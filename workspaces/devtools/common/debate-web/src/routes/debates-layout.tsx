import { useState } from 'react';
import { Outlet } from 'react-router';

import { Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';

/**
 * Debates layout — sidebar + main content area.
 * Nested routes render inside <Outlet />.
 */
export function DebatesLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isDragging, setIsDragging] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    let newWidth = e.clientX;

    // Handle collapse threshold
    if (newWidth < 100) {
      setIsCollapsed(true);
    } else {
      setIsCollapsed(false);
      // Clamp between min and max sizes
      newWidth = Math.max(200, Math.min(newWidth, 600));
      setSidebarWidth(newWidth);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.target.releasePointerCapture(e.pointerId);
  };

  // Determine actual rendered width
  const currentWidth = isCollapsed ? 64 : sidebarWidth;

  return (
    <div className="flex h-screen w-full items-stretch">
      <div
        style={{ width: currentWidth, minWidth: currentWidth }}
        className={cn(
          'flex relative',
          !isDragging && 'transition-all duration-300 ease-in-out',
        )}
      >
        <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />

        {/* Resizer Handle */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            'absolute right-0 top-0 z-10 h-full w-2 translate-x-1/2 cursor-col-resize select-none touch-none',
            isDragging && 'bg-border/50',
          )}
        />
      </div>

      {/* Separator visual (optional, match previous ResizableHandle look) */}
      <div className="bg-border w-px h-full relative z-0 flex items-center justify-center">
        {/* Optional drag grip visual can go here if desired */}
      </div>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
