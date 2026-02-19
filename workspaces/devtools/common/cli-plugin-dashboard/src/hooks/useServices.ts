/**
 * Hook: pm2 process list + health check data.
 *
 * Polls pm2 and health endpoints on interval.
 * Tracks loading/stale state per data source.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  checkAllEndpoints,
  DEFAULT_ENDPOINTS,
  type HealthEndpoint,
  type HealthResult,
} from '../lib/health.js';
import { getPm2Processes, type Pm2Process } from '../lib/pm2.js';
import { useInterval } from './useInterval.js';

export interface ServicesData {
  processes: Pm2Process[];
  processesLoading: boolean;
  processesStale: boolean;
  processesError?: string;
  healthResults: Array<HealthEndpoint & HealthResult>;
  healthLoading: boolean;
  lastUpdated: Date | null;
}

const POLL_INTERVAL = 5000;

export function useServices(intervalMs: number = POLL_INTERVAL): ServicesData {
  const [processes, setProcesses] = useState<Pm2Process[]>([]);
  const [processesLoading, setProcessesLoading] = useState(true);
  const [processesStale, setProcessesStale] = useState(false);
  const [processesError, setProcessesError] = useState<string | undefined>();
  const [healthResults, setHealthResults] = useState<
    Array<HealthEndpoint & HealthResult>
  >([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    // Fetch pm2 + health in parallel
    const [pm2Result, healthResult] = await Promise.all([
      getPm2Processes(),
      checkAllEndpoints(DEFAULT_ENDPOINTS),
    ]);

    setProcesses(pm2Result.processes);
    setProcessesStale(pm2Result.stale);
    setProcessesError(pm2Result.error);
    setProcessesLoading(false);

    setHealthResults(healthResult);
    setHealthLoading(false);

    setLastUpdated(new Date());
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Polling
  useInterval(() => {
    void fetchData();
  }, intervalMs);

  return {
    processes,
    processesLoading,
    processesStale,
    processesError,
    healthResults,
    healthLoading,
    lastUpdated,
  };
}
