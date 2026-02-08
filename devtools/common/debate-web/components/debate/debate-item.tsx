'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { Debate, DebateState } from '@/lib/types';

const stateColors: Record<DebateState, string> = {
  AWAITING_OPPONENT: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  AWAITING_PROPOSER: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  AWAITING_ARBITRATOR: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
  INTERVENTION_PENDING: 'bg-red-500/20 text-red-700 dark:text-red-300',
  CLOSED: 'bg-gray-500/20 text-gray-700 dark:text-gray-300',
};

const stateLabels: Record<DebateState, string> = {
  AWAITING_OPPONENT: 'Opponent',
  AWAITING_PROPOSER: 'Proposer',
  AWAITING_ARBITRATOR: 'Arbitrator',
  INTERVENTION_PENDING: 'Intervention',
  CLOSED: 'Closed',
};

type DebateItemProps = {
  debate: Debate;
  isActive?: boolean;
};

export function DebateItem({ debate, isActive }: DebateItemProps) {
  return (
    <Link
      href={`/debates/${debate.id}`}
      className={cn(
        'block rounded-lg p-3 transition-colors hover:bg-accent',
        isActive && 'bg-accent'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm line-clamp-2">{debate.title}</h3>
        <Badge
          variant="secondary"
          className={cn('shrink-0 text-xs', stateColors[debate.state])}
        >
          {stateLabels[debate.state]}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {debate.debate_type}
      </p>
    </Link>
  );
}
