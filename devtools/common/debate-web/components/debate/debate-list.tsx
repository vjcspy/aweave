'use client';

import { useDebatesList } from '@/hooks/use-debates-list';
import { DebateItem } from './debate-item';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useMemo } from 'react';
import { Search, Loader2 } from 'lucide-react';

type DebateListProps = {
  activeDebateId?: string;
};

export function DebateList({ activeDebateId }: DebateListProps) {
  const { debates, loading, error } = useDebatesList();
  const [search, setSearch] = useState('');

  const filteredDebates = useMemo(() => {
    if (!search.trim()) return debates;
    const lower = search.toLowerCase();
    return debates.filter(
      (d) =>
        d.title.toLowerCase().includes(lower) ||
        d.debate_type.toLowerCase().includes(lower)
    );
  }, [debates, search]);

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search debates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">
            {error}
          </div>
        ) : filteredDebates.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {search ? 'No debates found' : 'No debates yet'}
          </div>
        ) : (
          <div className="space-y-1 pb-3">
            {filteredDebates.map((debate) => (
              <DebateItem
                key={debate.id}
                debate={debate}
                isActive={debate.id === activeDebateId}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
