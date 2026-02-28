import { ArrowDown } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import type { Argument } from '@/lib/types';

import { ArgumentCard } from './argument-card';

type ArgumentListProps = {
  arguments: Argument[];
};

export function ArgumentList({ arguments: args }: ArgumentListProps) {
  if (args.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No arguments yet
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {args.map((arg, index) => (
          <div key={arg.id}>
            <ArgumentCard argument={arg} />
            {index < args.length - 1 && (
              <div className="flex justify-center my-2">
                <ArrowDown className="w-4 h-4 text-muted-foreground/30" />
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
