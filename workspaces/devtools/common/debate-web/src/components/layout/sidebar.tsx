import { MessageSquare, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useParams } from 'react-router';

import { DebateList } from '@/components/debate/debate-list';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import { ThemeToggle } from './theme-toggle';

export interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
  const params = useParams();
  const activeDebateId = params?.id as string | undefined;

  return (
    <aside className="group flex h-full w-full flex-col bg-sidebar">
      <div
        className={`flex h-14 items-center px-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <span className="font-semibold">Debate</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {!isCollapsed && <ThemeToggle />}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 text-muted-foreground"
            title={isCollapsed ? 'Open sidebar' : 'Close sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </div>
      </div>
      <Separator />
      {!isCollapsed ? (
        <div className="flex-1 overflow-hidden">
          <DebateList activeDebateId={activeDebateId} />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col items-center py-4">
          <MessageSquare className="h-5 w-5 text-muted-foreground transition-opacity opacity-50 group-hover:opacity-100" />
        </div>
      )}
    </aside>
  );
}
