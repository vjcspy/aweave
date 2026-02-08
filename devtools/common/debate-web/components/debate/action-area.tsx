'use client';

import { useState, useRef, useCallback } from 'react';
import { StopCircle, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import type { DebateState } from '@/lib/types';

type ActionAreaProps = {
  state: DebateState;
  onIntervention: (content?: string) => void;
  onRuling: (content: string, close?: boolean) => void;
};

export function ActionArea({ state, onIntervention, onRuling }: ActionAreaProps) {
  const [content, setContent] = useState('');
  const [closeDebate, setCloseDebate] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartRef = useRef<number>(0);

  const HOLD_DURATION = 1000; // 1 second hold to confirm

  const cancelHold = useCallback(() => {
    setIsHolding(false);
    setHoldProgress(0);
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const startHold = useCallback(() => {
    setIsHolding(true);
    holdStartRef.current = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        onIntervention();
        cancelHold();
      } else {
        holdTimerRef.current = setTimeout(updateProgress, 16);
      }
    };

    holdTimerRef.current = setTimeout(updateProgress, 16);
  }, [onIntervention, cancelHold]);

  const handleSubmitRuling = () => {
    if (!content.trim()) return;
    onRuling(content.trim(), closeDebate);
    setContent('');
    setCloseDebate(false);
  };

  // Closed state
  if (state === 'CLOSED') {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          This debate has been closed.
        </div>
      </Card>
    );
  }

  // States requiring Arbitrator ruling
  if (state === 'AWAITING_ARBITRATOR' || state === 'INTERVENTION_PENDING') {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          <div className="text-sm font-medium">
            {state === 'AWAITING_ARBITRATOR'
              ? 'Submit Ruling'
              : 'Submit Ruling (after Intervention)'}
          </div>
          <Textarea
            placeholder="Enter your ruling..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={closeDebate}
                onChange={(e) => setCloseDebate(e.target.checked)}
                className="rounded"
              />
              Close debate
            </label>
            <Button
              onClick={handleSubmitRuling}
              disabled={!content.trim()}
              size="sm"
            >
              <Send className="mr-2 h-4 w-4" />
              Submit Ruling
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // States where Arbitrator can intervene
  return (
    <Card className="p-4">
      <Button
        variant="destructive"
        className="relative w-full overflow-hidden"
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
      >
        {isHolding && (
          <div
            className="absolute inset-0 bg-red-800/50 transition-all"
            style={{ width: `${holdProgress}%` }}
          />
        )}
        <span className="relative flex items-center justify-center gap-2">
          {isHolding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <StopCircle className="h-4 w-4" />
          )}
          {isHolding ? 'Hold to confirm...' : 'Hold to Intervene'}
        </span>
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Hold button for 1 second to pause the debate
      </p>
    </Card>
  );
}
