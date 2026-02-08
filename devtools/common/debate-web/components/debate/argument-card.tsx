'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Argument, ArgumentType, Role } from '@/lib/types';

// Updated role colors for the Card background/border
const roleCardStyles: Record<Role, string> = {
  proposer: 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
  opponent: 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
  arbitrator: 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
};

// Keep badge colors distinct but harmonious
const roleBadgeStyles: Record<Role, string> = {
  proposer: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  opponent: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
  arbitrator: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
};

const roleLabels: Record<Role, string> = {
  proposer: 'Proposer',
  opponent: 'Opponent',
  arbitrator: 'Arbitrator',
};

const typeColors: Record<ArgumentType, string> = {
  MOTION: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  CLAIM: 'bg-sky-500/20 text-sky-700 dark:text-sky-300',
  APPEAL: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  RULING: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
  INTERVENTION: 'bg-red-500/20 text-red-700 dark:text-red-300',
  RESOLUTION: 'bg-green-500/20 text-green-700 dark:text-green-300',
};

function formatTime(dateString: string): { relative: string; absolute: string } {
  // SQLite returns "YYYY-MM-DD HH:MM:SS" which is UTC but missing T/Z
  // Force it to be treated as UTC
  const normalized = dateString.includes('T') || dateString.includes('Z') 
    ? dateString 
    : dateString.replace(' ', 'T') + 'Z';
    
  const date = new Date(normalized);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  // Absolute format: "10:30 AM" or "Feb 2, 10:30 AM"
  const absolute = date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  let relative = '';
  if (diffMins < 1) relative = 'just now';
  else if (diffMins < 60) relative = `${diffMins}m ago`;
  else {
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) relative = `${diffHours}h ago`;
    else {
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) relative = `${diffDays}d ago`;
      else relative = date.toLocaleDateString();
    }
  }

  return { relative, absolute };
}

type ArgumentCardProps = {
  argument: Argument;
};

export function ArgumentCard({ argument }: ArgumentCardProps) {
  const timeDisplay = formatTime(argument.created_at);

  return (
    <Card
      className={cn(
        'transition-colors border',
        roleCardStyles[argument.role]
      )}
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn('text-xs', roleBadgeStyles[argument.role])}>
              {roleLabels[argument.role]}
            </Badge>
            <Badge variant="secondary" className={cn('text-xs', typeColors[argument.type])}>
              {argument.type}
            </Badge>
          </div>
          <span 
            className="text-xs text-muted-foreground cursor-help"
            title={timeDisplay.absolute}
          >
            {timeDisplay.relative} ({timeDisplay.absolute})
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-pre:bg-muted prose-pre:text-foreground prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {argument.content}
          </ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}

