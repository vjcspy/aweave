/**
 * Hook: native daemon service status + health check data.
 *
 * Polls server daemon state and health endpoints on interval.
 * Tracks loading/stale state per data source.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  checkAllEndpoints,
  DEFAULT_ENDPOINTS,
  type HealthEndpoint,
  type HealthResult,
} from '../lib/health.js';
import {
  type DashboardService,
  getDashboardServices,
} from '../lib/server-daemon.js';
import { useInterval } from './useInterval.js';

export interface ServicesData {
  services: DashboardService[];
  servicesLoading: boolean;
  servicesStale: boolean;
  servicesError?: string;
  healthResults: Array<HealthEndpoint & HealthResult>;
  healthLoading: boolean;
  lastUpdated: Date | null;
}

const POLL_INTERVAL = 5000;

export function useServices(intervalMs: number = POLL_INTERVAL): ServicesData {
  const [services, setServices] = useState<DashboardService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesStale, setServicesStale] = useState(false);
  const [servicesError, setServicesError] = useState<string | undefined>();
  const [healthResults, setHealthResults] = useState<
    Array<HealthEndpoint & HealthResult>
  >([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    // Fetch daemon status + health in parallel
    const [servicesResult, healthResult] = await Promise.all([
      getDashboardServices(),
      checkAllEndpoints(DEFAULT_ENDPOINTS),
    ]);

    setServices(servicesResult.services);
    setServicesStale(servicesResult.stale);
    setServicesError(servicesResult.error);
    setServicesLoading(false);

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
    services,
    servicesLoading,
    servicesStale,
    servicesError,
    healthResults,
    healthLoading,
    lastUpdated,
  };
}
