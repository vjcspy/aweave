import {
  AlertTriangle,
  ArrowDown,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Pause,
  Play,
  RefreshCcw,
  ScrollText,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LogEntry {
  level: number;
  time: number;
  msg: string;
  context?: string;
  correlationId?: string;
  service?: string;
  source?: string;
  meta?: Record<string, unknown>;
}

interface LogSource {
  name: string;
  dates: string[];
  latestDate: string;
}

interface Pagination {
  limit: number;
  returned: number;
  hasMore: boolean;
  nextCursor: string | null;
}

type LevelFilter =
  | 'all'
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal';

const LEVEL_MAP: Record<
  number,
  { name: string; color: string; bg: string; dot: string }
> = {
  10: {
    name: 'TRACE',
    color: 'text-zinc-500',
    bg: 'bg-zinc-800/40',
    dot: 'bg-zinc-500',
  },
  20: {
    name: 'DEBUG',
    color: 'text-zinc-400',
    bg: 'bg-zinc-700/30',
    dot: 'bg-zinc-400',
  },
  30: {
    name: 'INFO',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    dot: 'bg-blue-400',
  },
  40: {
    name: 'WARN',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    dot: 'bg-amber-400',
  },
  50: {
    name: 'ERROR',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    dot: 'bg-red-400',
  },
  60: {
    name: 'FATAL',
    color: 'text-red-300',
    bg: 'bg-red-600/15',
    dot: 'bg-red-300',
  },
};

const SOURCE_COLORS: string[] = [
  'bg-blue-500/10 text-blue-400',
  'bg-purple-500/10 text-purple-400',
  'bg-cyan-500/10 text-cyan-400',
  'bg-amber-500/10 text-amber-400',
  'bg-pink-500/10 text-pink-400',
  'bg-teal-500/10 text-teal-400',
  'bg-indigo-500/10 text-indigo-400',
  'bg-emerald-500/10 text-emerald-400',
  'bg-orange-500/10 text-orange-400',
  'bg-rose-500/10 text-rose-400',
];

function getLevelInfo(level: number) {
  return (
    LEVEL_MAP[level] ?? {
      name: `L${level}`,
      color: 'text-zinc-400',
      bg: 'bg-zinc-800/40',
      dot: 'bg-zinc-400',
    }
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const MAX_VISIBLE_LOGS = 2000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LogsView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sources, setSources] = useState<LogSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const [selectedName, setSelectedName] = useState('all');
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [paused, setPaused] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const sourceColorMap = useMemo(() => {
    const map = new Map<string, string>();
    sources.forEach((s, i) => {
      map.set(s.name, SOURCE_COLORS[i % SOURCE_COLORS.length]);
    });
    return map;
  }, [sources]);

  const isToday = selectedDate === getTodayDate();
  const isLive = isToday && !paused;

  useEffect(() => {
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery]);

  // Load sources
  useEffect(() => {
    fetch('/logs/sources')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSources(data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Load log entries
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLogs([]);
    setPagination(null);

    try {
      const params = new URLSearchParams({
        name: selectedName,
        date: selectedDate,
        limit: '500',
      });
      if (levelFilter !== 'all') params.set('level', levelFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/logs/query?${params}`);
      const data = await res.json();

      if (data.success) {
        setLogs(data.data);
        setPagination(data.pagination);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, [selectedName, selectedDate, levelFilter, debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!pagination?.nextCursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        name: selectedName,
        date: selectedDate,
        limit: '500',
        cursor: pagination.nextCursor,
      });
      if (levelFilter !== 'all') params.set('level', levelFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/logs/query?${params}`);
      const data = await res.json();

      if (data.success) {
        setLogs((prev) => [...data.data, ...prev]);
        setPagination(data.pagination);
      }
    } catch {
      // Network error
    } finally {
      setLoadingMore(false);
    }
  }, [
    pagination,
    loadingMore,
    selectedName,
    selectedDate,
    levelFilter,
    debouncedSearch,
  ]);

  // SSE streaming
  useEffect(() => {
    if (!isToday) return;

    const es = new EventSource(
      `/logs/stream?name=${encodeURIComponent(selectedName)}`,
    );
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const entry: LogEntry = JSON.parse(event.data);

        if (levelFilter !== 'all') {
          const levelMap: Record<string, number> = {
            trace: 10,
            debug: 20,
            info: 30,
            warn: 40,
            error: 50,
            fatal: 60,
          };
          if (entry.level < (levelMap[levelFilter] ?? 0)) return;
        }
        if (
          debouncedSearch &&
          !entry.msg.toLowerCase().includes(debouncedSearch.toLowerCase())
        )
          return;

        setLogs((prev) => {
          const next = [...prev, entry];
          return next.length > MAX_VISIBLE_LOGS
            ? next.slice(-MAX_VISIBLE_LOGS)
            : next;
        });
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {};

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isToday, selectedName, levelFilter, debouncedSearch]);

  // Auto-scroll
  useEffect(() => {
    if (autoScrollRef.current && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, paused]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 60;
  }, []);

  const clearLogs = () => setLogs([]);

  const scrollToBottom = () => {
    autoScrollRef.current = true;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

  const copyCorrelation = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const showSource = selectedName === 'all';
  const errorCount = logs.filter((l) => l.level >= 50).length;
  const warnCount = logs.filter((l) => l.level === 40).length;

  const availableDates = useMemo(() => {
    if (selectedName === 'all') {
      const allDates = new Set<string>();
      sources.forEach((s) => s.dates.forEach((d) => allDates.add(d)));
      return Array.from(allDates).sort().reverse();
    }
    return sources.find((s) => s.name === selectedName)?.dates ?? [];
  }, [selectedName, sources]);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* ── Toolbar ── */}
      <div className="glass-panel rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/15">
              <ScrollText className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Server Logs</h2>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 ml-1">
            <span className="text-[11px] text-zinc-600 font-mono tabular-nums">
              {logs.length.toLocaleString()} entries
            </span>
            {errorCount > 0 && (
              <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium border border-red-500/10">
                {errorCount} errors
              </span>
            )}
            {warnCount > 0 && (
              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-medium border border-amber-500/10">
                {warnCount} warns
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isToday && (
            <button
              onClick={() => setPaused(!paused)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border ${
                paused
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/15'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] border-transparent'
              }`}
            >
              {paused ? (
                <Play className="w-3 h-3" />
              ) : (
                <Pause className="w-3 h-3" />
              )}
              {paused ? 'Resume' : 'Pause'}
            </button>
          )}

          <button
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] border border-transparent transition-all duration-200"
            title="Scroll to bottom"
          >
            <ArrowDown className="w-3 h-3" />
          </button>

          <button
            onClick={clearLogs}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/[0.06] border border-transparent transition-all duration-200"
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          {/* Stream indicator */}
          <div className="flex items-center gap-1.5 ml-1.5 pl-3 border-l border-zinc-800/50">
            <div className="relative flex h-2 w-2">
              {isLive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/50" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${isLive ? 'bg-emerald-400' : isToday && paused ? 'bg-amber-400' : 'bg-zinc-600'}`}
              />
            </div>
            <span className="text-[10px] text-zinc-500 font-medium">
              {isLive ? 'Live' : isToday && paused ? 'Paused' : 'Historical'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="glass-panel rounded-2xl px-5 py-3 flex items-center gap-3 shrink-0">
        {/* Name selector */}
        <div className="relative">
          <select
            id="log-name-filter"
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
            className="appearance-none bg-zinc-900/60 border border-zinc-700/30 rounded-lg px-3 py-1.5 pr-7 text-[12px] text-zinc-300 focus:outline-none focus:border-emerald-500/30 cursor-pointer min-w-[130px] transition-colors"
          >
            <option value="all">All Sources</option>
            {sources.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
        </div>

        {/* Date picker */}
        <div className="relative flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-zinc-600" />
          <input
            id="log-date-filter"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-zinc-900/60 border border-zinc-700/30 rounded-lg px-3 py-1.5 text-[12px] text-zinc-300 focus:outline-none focus:border-emerald-500/30 cursor-pointer transition-colors"
          />
          {availableDates.length > 0 &&
            !availableDates.includes(selectedDate) && (
              <span
                className="text-[10px] text-amber-500"
                title="No logs found for this date"
              >
                ⚠
              </span>
            )}
        </div>

        {/* Level filter */}
        <div className="relative">
          <select
            id="log-level-filter"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
            className="appearance-none bg-zinc-900/60 border border-zinc-700/30 rounded-lg px-3 py-1.5 pr-7 text-[12px] text-zinc-300 focus:outline-none focus:border-emerald-500/30 cursor-pointer transition-colors"
          >
            <option value="all">All Levels</option>
            <option value="trace">≥ Trace</option>
            <option value="debug">≥ Debug</option>
            <option value="info">≥ Info</option>
            <option value="warn">≥ Warn</option>
            <option value="error">≥ Error</option>
            <option value="fatal">≥ Fatal</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
          <input
            id="log-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full bg-zinc-900/60 border border-zinc-700/30 rounded-lg pl-7 pr-7 py-1.5 text-[12px] text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-emerald-500/30 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-zinc-600 hover:text-zinc-300 transition-colors" />
            </button>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors rounded-lg hover:bg-white/[0.03]"
          title="Refresh"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Log entries ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="glass-panel rounded-2xl flex-1 overflow-y-auto font-mono text-[12px]"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-500 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500/70" />
            <span className="text-sm">Loading logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/20 flex items-center justify-center border border-zinc-700/15">
              <ScrollText className="w-8 h-8 text-zinc-700" strokeWidth={1.2} />
            </div>
            <p className="text-sm text-zinc-500">
              No logs found for this selection
            </p>
            <p className="text-[11px] text-zinc-700">
              Try changing the source, date, or filters
            </p>
          </div>
        ) : (
          <>
            {pagination?.hasMore && (
              <div className="flex justify-center py-2.5 border-b border-zinc-800/20">
                <button
                  id="load-more-logs"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/[0.06] rounded-lg transition-all duration-200 disabled:opacity-40 font-medium"
                >
                  {loadingMore ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ChevronUp className="w-3 h-3" />
                  )}
                  {loadingMore ? 'Loading...' : 'Load older entries'}
                </button>
              </div>
            )}

            <table className="w-full border-collapse">
              <tbody>
                {logs.map((entry, idx) => {
                  const info = getLevelInfo(entry.level);
                  return (
                    <tr
                      key={`${entry.time}-${idx}`}
                      className={`log-row border-b border-zinc-800/20 group ${
                        entry.level >= 50
                          ? 'log-row-error'
                          : entry.level === 40
                            ? 'log-row-warn'
                            : ''
                      }`}
                    >
                      {/* Time */}
                      <td className="px-3 py-1.5 text-zinc-600 whitespace-nowrap align-top w-[90px]">
                        {formatTime(entry.time)}
                      </td>

                      {/* Source */}
                      {showSource && (
                        <td className="px-1 py-1.5 align-top w-[110px]">
                          {entry.source && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[100px] inline-block ${
                                sourceColorMap.get(entry.source) ??
                                'bg-zinc-800/40 text-zinc-400'
                              }`}
                            >
                              {entry.source}
                            </span>
                          )}
                        </td>
                      )}

                      {/* Level badge */}
                      <td className="px-1 py-1.5 align-top w-[60px]">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${info.color} ${info.bg}`}
                        >
                          <span
                            className={`w-1 h-1 rounded-full ${info.dot}`}
                          />
                          {info.name}
                        </span>
                      </td>

                      {/* Context */}
                      <td className="px-2 py-1.5 text-purple-400/60 whitespace-nowrap align-top w-[150px] truncate max-w-[150px]">
                        {entry.context ?? ''}
                      </td>

                      {/* Message */}
                      <td className="px-2 py-1.5 text-zinc-300/90 align-top break-all">
                        <span>{entry.msg}</span>
                        {entry.meta && Object.keys(entry.meta).length > 0 && (
                          <span className="text-zinc-600 ml-2">
                            {Object.entries(entry.meta)
                              .map(
                                ([k, v]) =>
                                  `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`,
                              )
                              .join(' ')}
                          </span>
                        )}
                      </td>

                      {/* Correlation ID */}
                      <td className="px-2 py-1.5 align-top w-[90px]">
                        {entry.correlationId && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() =>
                                copyCorrelation(entry.correlationId!)
                              }
                              className="text-[10px] text-emerald-500/60 hover:text-emerald-400 font-mono truncate max-w-[55px]"
                              title={`Copy: ${entry.correlationId}`}
                            >
                              {entry.correlationId.slice(0, 8)}
                            </button>
                            <button
                              onClick={() =>
                                copyCorrelation(entry.correlationId!)
                              }
                              className="text-zinc-600 hover:text-zinc-400 transition-colors"
                              title="Copy correlation ID"
                            >
                              {copiedId === entry.correlationId ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Paused indicator */}
      {isToday && paused && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel text-amber-300 px-5 py-2.5 rounded-full text-[11px] font-medium flex items-center gap-2.5 z-50 border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5" />
          Auto-scroll paused — new logs are still being captured
          <button
            onClick={() => {
              setPaused(false);
              scrollToBottom();
            }}
            className="ml-1 text-amber-200 hover:text-white underline underline-offset-2"
          >
            Resume
          </button>
        </div>
      )}
    </div>
  );
}
