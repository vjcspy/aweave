'use client';

import { useParams } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { DebateList } from '@/components/debate/debate-list';
import { Separator } from '@/components/ui/separator';

export function Sidebar() {
  const params = useParams();
  const activeDebateId = params?.id as string | undefined;

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <span className="font-semibold">Debate</span>
        </div>
        <ThemeToggle />
      </div>
      <Separator />
      <div className="flex-1 overflow-hidden">
        <DebateList activeDebateId={activeDebateId} />
      </div>
    </aside>
  );
}
