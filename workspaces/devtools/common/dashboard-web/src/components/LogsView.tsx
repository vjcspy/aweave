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

const LEVEL_MAP: Record<number, { name: string; color: string; bg: string }> = {
  10: { name: 'TRACE', color: 'text-zinc-500', bg: 'bg-zinc-800/50' },
  20: { name: 'DEBUG', color: 'text-zinc-400', bg: 'bg-zinc-700/50' },
  30: { name: 'INFO', color: 'text-blue-400', bg: 'bg-blue-500/15' },
  40: { name: 'WARN', color: 'text-amber-400', bg: 'bg-amber-500/15' },
  50: { name: 'ERROR', color: 'text-red-400', bg: 'bg-red-500/15' },
  60: { name: 'FATAL', color: 'text-red-300', bg: 'bg-red-600/20' },
};

// Subtle color chips for different sources when name=all
const SOURCE_COLORS: string[] = [
  'bg-blue-500/15 text-blue-400',
  'bg-purple-500/15 text-purple-400',
  'bg-cyan-500/15 text-cyan-400',
  'bg-amber-500/15 text-amber-400',
  'bg-pink-500/15 text-pink-400',
  'bg-teal-500/15 text-teal-400',
  'bg-indigo-500/15 text-indigo-400',
  'bg-emerald-500/15 text-emerald-400',
  'bg-orange-500/15 text-orange-400',
  'bg-rose-500/15 text-rose-400',
];

function getLevelInfo(level: number) {
  return (
    LEVEL_MAP[level] ?? {
      name: `L${level}`,
      color: 'text-zinc-400',
      bg: 'bg-zinc-800/50',
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
  // Data state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sources, setSources] = useState<LogSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  // Filter state
  const [selectedName, setSelectedName] = useState('all');
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // UI state
  const [paused, setPaused] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Source color map
  const sourceColorMap = useMemo(() => {
    const map = new Map<string, string>();
    sources.forEach((s, i) => {
      map.set(s.name, SOURCE_COLORS[i % SOURCE_COLORS.length]);
    });
    return map;
  }, [sources]);

  const isToday = selectedDate === getTodayDate();
  const isLive = isToday && !paused;

  // Debounce search
  useEffect(() => {
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery]);

  // ---------------------------------------------------------------------------
  // Load sources
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Load log entries when filters change
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Load more (older entries)
  // ---------------------------------------------------------------------------

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
        // Prepend older entries
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

  // ---------------------------------------------------------------------------
  // SSE streaming — only when date is today
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isToday) return;

    const es = new EventSource(
      `/logs/stream?name=${encodeURIComponent(selectedName)}`,
    );
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const entry: LogEntry = JSON.parse(event.data);

        // Apply client-side filters for SSE entries
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

    es.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isToday, selectedName, levelFilter, debouncedSearch]);

  // ---------------------------------------------------------------------------
  // Auto-scroll
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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

  // Counts
  const errorCount = logs.filter((l) => l.level >= 50).length;
  const warnCount = logs.filter((l) => l.level === 40).length;

  // Available dates from selected source
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
      {/* Toolbar */}
      <div className="glass-panel rounded-xl px-5 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Logs</h2>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 ml-1">
            <span className="text-xs text-zinc-500 font-mono">
              {logs.length} entries
            </span>
            {errorCount > 0 && (
              <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-medium">
                {errorCount} errors
              </span>
            )}
            {warnCount > 0 && (
              <span className="text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-medium">
                {warnCount} warns
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pause/Resume (only when live) */}
          {isToday && (
            <button
              onClick={() => setPaused(!paused)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                paused
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border-transparent'
              }`}
            >
              {paused ? (
                <Play className="w-3.5 h-3.5" />
              ) : (
                <Pause className="w-3.5 h-3.5" />
              )}
              {paused ? 'Resume' : 'Pause'}
            </button>
          )}

          {/* Scroll to bottom */}
          <button
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent transition-all duration-200"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Clear */}
          <button
            onClick={clearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent transition-all duration-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Stream indicator */}
          <div className="flex items-center gap-1.5 ml-1 pl-3 border-l border-zinc-800">
            <div
              className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : isToday && paused ? 'bg-amber-400' : 'bg-zinc-600'}`}
            />
            <span className="text-xs text-zinc-500">
              {isLive ? 'Live' : isToday && paused ? 'Paused' : 'Historical'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel rounded-xl px-5 py-3 flex items-center gap-3 shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
        {/* Name selector */}
        <div className="relative">
          <select
            id="log-name-filter"
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
            className="appearance-none bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-1.5 pr-7 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 cursor-pointer min-w-[140px]"
          >
            <option value="all">All Sources</option>
            {sources.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>

        {/* Date picker */}
        <div className="relative flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
          <input
            id="log-date-filter"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
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
            className="appearance-none bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-1.5 pr-7 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
          >
            <option value="all">All Levels</option>
            <option value="trace">≥ Trace</option>
            <option value="debug">≥ Debug</option>
            <option value="info">≥ Info</option>
            <option value="warn">≥ Warn</option>
            <option value="error">≥ Error</option>
            <option value="fatal">≥ Fatal</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
          <input
            id="log-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg pl-7 pr-7 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
            </button>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Refresh"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="glass-panel rounded-xl flex-1 overflow-y-auto custom-scrollbar font-mono text-[13px]"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-500 gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
            <ScrollText className="w-10 h-10" strokeWidth={1} />
            <p className="text-sm">No logs found for this selection</p>
            <p className="text-xs text-zinc-700">
              Try changing the source, date, or filters
            </p>
          </div>
        ) : (
          <>
            {/* Load more button (older entries) */}
            {pagination?.hasMore && (
              <div className="flex justify-center py-2 border-b border-zinc-800/30">
                <button
                  id="load-more-logs"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
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
                      className={`border-b border-zinc-800/30 hover:bg-white/[0.02] transition-colors group ${
                        entry.level >= 50
                          ? 'bg-red-950/10'
                          : entry.level === 40
                            ? 'bg-amber-950/10'
                            : ''
                      }`}
                    >
                      {/* Time */}
                      <td className="px-3 py-1.5 text-zinc-600 whitespace-nowrap align-top w-[90px]">
                        {formatTime(entry.time)}
                      </td>

                      {/* Source (only when name=all) */}
                      {showSource && (
                        <td className="px-1 py-1.5 align-top w-[120px]">
                          {entry.source && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[110px] inline-block ${
                                sourceColorMap.get(entry.source) ??
                                'bg-zinc-800/50 text-zinc-400'
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
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${info.color} ${info.bg}`}
                        >
                          {info.name}
                        </span>
                      </td>

                      {/* Context */}
                      <td className="px-2 py-1.5 text-purple-400/70 whitespace-nowrap align-top w-[160px] truncate max-w-[160px]">
                        {entry.context ?? ''}
                      </td>

                      {/* Message */}
                      <td className="px-2 py-1.5 text-zinc-300 align-top break-all">
                        <span>{entry.msg}</span>
                        {/* Inline meta */}
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
                      <td className="px-2 py-1.5 align-top w-[100px]">
                        {entry.correlationId && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() =>
                                copyCorrelation(entry.correlationId!)
                              }
                              className="text-[10px] text-emerald-500/70 hover:text-emerald-400 font-mono truncate max-w-[60px]"
                              title={`Copy: ${entry.correlationId}`}
                            >
                              {entry.correlationId.slice(0, 8)}
                            </button>
                            <button
                              onClick={() =>
                                copyCorrelation(entry.correlationId!)
                              }
                              className="text-zinc-600 hover:text-zinc-400"
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-amber-500/20 border border-amber-500/30 text-amber-300 px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 backdrop-blur-md shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          Auto-scroll paused — new logs are still being captured
          <button
            onClick={() => {
              setPaused(false);
              scrollToBottom();
            }}
            className="ml-1 text-amber-200 hover:text-white underline"
          >
            Resume
          </button>
        </div>
      )}
    </div>
  );
}
