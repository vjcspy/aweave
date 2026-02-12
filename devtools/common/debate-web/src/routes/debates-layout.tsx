import { Outlet } from 'react-router';

import { Sidebar } from '@/components/layout/sidebar';

/**
 * Debates layout — sidebar + main content area.
 * Nested routes render inside <Outlet />.
 */
export function DebatesLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
