import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronDown,
  Copy,
  Filter,
  Pause,
  Play,
  RefreshCcw,
  ScrollText,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

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
  meta?: Record<string, unknown>;
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

const LEVEL_NUMBERS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_VISIBLE_LOGS = 2000;

export function LogsView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(true);
  const [paused, setPaused] = useState(false);

  // Filters
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [contextFilter, setContextFilter] = useState('');
  const [correlationFilter, setCorrelationFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load initial tail
  useEffect(() => {
    setLoading(true);
    fetch('/logs/tail?lines=500')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setLogs(data.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Connect SSE stream
  useEffect(() => {
    if (!streaming) return;

    const es = new EventSource('/logs/stream');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const entry: LogEntry = JSON.parse(event.data);
        setLogs((prev) => {
          const next = [...prev, entry];
          // Cap at MAX to prevent memory issues
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
  }, [streaming]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScrollRef.current && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, paused]);

  // Handle scroll — detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 60;
  }, []);

  // Filter logs
  const filtered = React.useMemo(() => {
    return logs.filter((entry) => {
      if (
        levelFilter !== 'all' &&
        entry.level < (LEVEL_NUMBERS[levelFilter] ?? 0)
      )
        return false;
      if (
        contextFilter &&
        !entry.context?.toLowerCase().includes(contextFilter.toLowerCase())
      )
        return false;
      if (correlationFilter && entry.correlationId !== correlationFilter)
        return false;
      if (
        searchQuery &&
        !entry.msg.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });
  }, [logs, levelFilter, contextFilter, correlationFilter, searchQuery]);

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

  const filterByCorrelation = (id: string) => {
    setCorrelationFilter(id);
    setShowFilters(true);
  };

  const activeFilterCount = [
    levelFilter !== 'all',
    !!contextFilter,
    !!correlationFilter,
    !!searchQuery,
  ].filter(Boolean).length;

  // Counts by level
  const errorCount = logs.filter((l) => l.level >= 50).length;
  const warnCount = logs.filter((l) => l.level === 40).length;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="glass-panel rounded-xl px-5 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Server Logs</h2>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-zinc-500 font-mono">
              {filtered.length} lines
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
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
              showFilters || activeFilterCount > 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border-transparent'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-emerald-500 text-white w-4 h-4 rounded-full text-[10px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Pause/Resume */}
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
              className={`w-2 h-2 rounded-full ${streaming && !paused ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}
            />
            <span className="text-xs text-zinc-500">
              {streaming && !paused
                ? 'Live'
                : paused
                  ? 'Paused'
                  : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="glass-panel rounded-xl px-5 py-3 flex items-center gap-3 shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Level filter */}
          <div className="relative">
            <select
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

          {/* Context filter */}
          <div className="relative flex-1 max-w-[200px]">
            <input
              type="text"
              value={contextFilter}
              onChange={(e) => setContextFilter(e.target.value)}
              placeholder="Context..."
              className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Correlation ID filter */}
          <div className="relative flex-1 max-w-[280px]">
            <input
              type="text"
              value={correlationFilter}
              onChange={(e) => setCorrelationFilter(e.target.value)}
              placeholder="Correlation ID..."
              className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 font-mono"
            />
            {correlationFilter && (
              <button
                onClick={() => setCorrelationFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg pl-7 pr-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Clear all filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setLevelFilter('all');
                setContextFilter('');
                setCorrelationFilter('');
                setSearchQuery('');
              }}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="glass-panel rounded-xl flex-1 overflow-y-auto custom-scrollbar font-mono text-[13px]"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-500 gap-3">
            <RefreshCcw className="w-5 h-5 animate-spin" />
            <span>Loading logs...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
            <ScrollText className="w-10 h-10" strokeWidth={1} />
            <p className="text-sm">
              {logs.length === 0
                ? 'No logs available'
                : 'No logs match filters'}
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {filtered.map((entry, idx) => {
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
                              filterByCorrelation(entry.correlationId!)
                            }
                            className="text-[10px] text-emerald-500/70 hover:text-emerald-400 font-mono truncate max-w-[60px]"
                            title={`Filter: ${entry.correlationId}`}
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
        )}
      </div>

      {/* Paused indicator */}
      {paused && (
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
