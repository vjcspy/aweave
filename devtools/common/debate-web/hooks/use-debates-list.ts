'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Debate } from '@/lib/api';
import { fetchDebates } from '@/lib/api';

export function useDebatesList(pollInterval = 5000) {
  const [debates, setDebates] = useState<Debate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchDebates();
      setDebates(data.debates);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch debates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [refresh, pollInterval]);

  return { debates, loading, error, refresh };
}
