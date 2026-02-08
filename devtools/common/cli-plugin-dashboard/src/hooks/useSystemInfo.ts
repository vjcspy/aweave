/**
 * Hook: CPU, memory, disk usage + version info.
 *
 * Polls CPU/memory every 2s, disk every 10s, versions once on mount.
 * Maintains sparkline history (last 30 readings for CPU).
 */

import { useCallback, useEffect, useState } from 'react';

import {
  getCpuUsage,
  getDiskUsage,
  getMemoryUsage,
  getVersionInfo,
  type DiskInfo,
  type MemoryInfo,
  type VersionInfo,
} from '../lib/system.js';
import { useInterval } from './useInterval.js';

const FAST_POLL = 2000;
const SLOW_POLL = 10_000;
const SPARKLINE_HISTORY = 30;

export interface SystemInfoData {
  cpu: number;
  cpuHistory: number[];
  memory: MemoryInfo;
  disk: DiskInfo | null;
  versions: VersionInfo | null;
  loading: boolean;
}

export function useSystemInfo(): SystemInfoData {
  const [cpu, setCpu] = useState(0);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memory, setMemory] = useState<MemoryInfo>({
    used: 0,
    total: 0,
    percentage: 0,
    usedFormatted: '—',
    totalFormatted: '—',
  });
  const [disk, setDisk] = useState<DiskInfo | null>(null);
  const [versions, setVersions] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Fast poll: CPU + memory
  const pollFast = useCallback(() => {
    const cpuVal = getCpuUsage();
    setCpu(cpuVal);
    setCpuHistory((prev) => [...prev.slice(-(SPARKLINE_HISTORY - 1)), cpuVal]);
    setMemory(getMemoryUsage());
    setLoading(false);
  }, []);

  // Slow poll: disk
  const pollDisk = useCallback(async () => {
    const diskInfo = await getDiskUsage();
    setDisk(diskInfo);
  }, []);

  // Initial fetch
  useEffect(() => {
    pollFast();
    void pollDisk();
    void getVersionInfo().then(setVersions);
  }, [pollFast, pollDisk]);

  useInterval(pollFast, FAST_POLL);
  useInterval(() => { void pollDisk(); }, SLOW_POLL);

  return { cpu, cpuHistory, memory, disk, versions, loading };
}
