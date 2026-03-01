import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { homedir } from 'os';
import * as path from 'path';

import type { LogEntryDto } from '../dtos/logs.dto';

const DEFAULT_LOG_DIR = path.join(homedir(), '.aweave', 'logs');

/** Regex patterns for log filenames (skip .error. files) */
// Async pattern: {name}.{date}.{count}.log
const ASYNC_LOG_RE = /^(.+?)\.(\d{4}-\d{2}-\d{2})\.(\d+)\.log$/;
// Sync pattern: {name}.{date}.log
const SYNC_LOG_RE = /^(.+?)\.(\d{4}-\d{2}-\d{2})\.log$/;

const LEVEL_NUMBERS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

interface LogFileInfo {
  filename: string;
  name: string;
  date: string;
  count?: number;
}

interface CursorData {
  time: number;
  skip: number;
}

interface QueryOptions {
  level?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

interface QueryResult {
  entries: LogEntryDto[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface FileWatchState {
  offset: number;
  remainder: string;
}

/**
 * Service for reading, querying, and tailing log files.
 *
 * Log files are date-partitioned per service in ~/.aweave/logs/.
 * Supports cursor-based pagination, multi-source merging, and SSE.
 */
@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  private get logDir(): string {
    return process.env.LOG_DIR ?? DEFAULT_LOG_DIR;
  }

  // ---------------------------------------------------------------------------
  // Directory scanning
  // ---------------------------------------------------------------------------

  /**
   * Scan the log directory and return discovered log sources with their dates.
   */
  scanLogDirectory(): Map<string, Set<string>> {
    const dir = this.logDir;
    const result = new Map<string, Set<string>>();

    if (!fs.existsSync(dir)) {
      this.logger.warn({ dir }, 'Log directory not found');
      return result;
    }

    try {
      const files = fs.readdirSync(dir);
      for (const filename of files) {
        // Skip error-only files
        if (filename.includes('.error.')) continue;

        const info = this.parseLogFilename(filename);
        if (!info) continue;

        let dates = result.get(info.name);
        if (!dates) {
          dates = new Set<string>();
          result.set(info.name, dates);
        }
        dates.add(info.date);
      }
    } catch (err) {
      this.logger.error(
        { dir, error: String(err) },
        'Failed to scan log directory',
      );
    }

    return result;
  }

  /**
   * Parse a log filename and extract name, date, and optional count.
   */
  private parseLogFilename(filename: string): LogFileInfo | null {
    let match = ASYNC_LOG_RE.exec(filename);
    if (match) {
      return {
        filename,
        name: match[1],
        date: match[2],
        count: parseInt(match[3], 10),
      };
    }

    match = SYNC_LOG_RE.exec(filename);
    if (match) {
      return {
        filename,
        name: match[1],
        date: match[2],
      };
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Query engine
  // ---------------------------------------------------------------------------

  /**
   * Query log entries with cursor-based pagination.
   * Default (no cursor) returns the most recent entries (tail behavior).
   */
  queryLogs(
    name: string,
    date: string,
    options: QueryOptions = {},
  ): QueryResult {
    const limit = Math.min(Math.max(options.limit ?? 500, 1), 2000);
    const levelThreshold = options.level
      ? (LEVEL_NUMBERS[options.level] ?? 0)
      : 0;
    const searchLower = options.search?.toLowerCase();
    const cursor = options.cursor ? this.decodeCursor(options.cursor) : null;

    // Collect matching files
    const files = this.findLogFiles(name, date);
    if (files.length === 0) {
      return { entries: [], hasMore: false, nextCursor: null };
    }

    // Read and parse all entries from matching files
    let allEntries: LogEntryDto[] = [];
    for (const file of files) {
      const filePath = path.join(this.logDir, file.filename);
      const entries = this.readLogFile(filePath, file.name);
      allEntries.push(...entries);
    }

    // Apply level filter
    if (levelThreshold > 0) {
      allEntries = allEntries.filter((e) => e.level >= levelThreshold);
    }

    // Apply search filter
    if (searchLower) {
      allEntries = allEntries.filter((e) =>
        e.msg.toLowerCase().includes(searchLower),
      );
    }

    // Sort descending by time (newest first) for tail behavior
    allEntries.sort((a, b) => b.time - a.time);

    // Apply cursor: exclude entries at or after cursor time
    if (cursor) {
      let skipCount = cursor.skip;
      allEntries = allEntries.filter((e) => {
        if (e.time > cursor.time) return false;
        if (e.time === cursor.time) {
          if (skipCount > 0) {
            skipCount--;
            return false;
          }
        }
        return true;
      });
    }

    // Check if there are more entries beyond this page
    const hasMore = allEntries.length > limit;

    // Take the first `limit` entries (these are the newest in the remaining set)
    const page = allEntries.slice(0, limit);

    // Build nextCursor from the oldest entry in the page
    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const oldestInPage = page[page.length - 1];
      const countAtOldestTime = page.filter(
        (e) => e.time === oldestInPage.time,
      ).length;
      nextCursor = this.encodeCursor({
        time: oldestInPage.time,
        skip: countAtOldestTime,
      });
    }

    // Re-sort page ascending for display (oldest to newest within page)
    page.sort((a, b) => a.time - b.time);

    return {
      entries: page,
      hasMore,
      nextCursor,
    };
  }

  /**
   * Find log files matching name (or all) and date.
   */
  private findLogFiles(name: string, date: string): LogFileInfo[] {
    const dir = this.logDir;
    if (!fs.existsSync(dir)) return [];

    try {
      const files = fs.readdirSync(dir);
      const result: LogFileInfo[] = [];

      for (const filename of files) {
        if (filename.includes('.error.')) continue;

        const info = this.parseLogFilename(filename);
        if (!info) continue;
        if (info.date !== date) continue;
        if (name !== 'all' && info.name !== name) continue;

        result.push(info);
      }

      return result;
    } catch {
      return [];
    }
  }

  /**
   * Read and parse all JSONL entries from a log file.
   */
  private readLogFile(filePath: string, sourceName: string): LogEntryDto[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      const entries: LogEntryDto[] = [];

      for (const line of lines) {
        const entry = this.parseLine(line, sourceName);
        if (entry) entries.push(entry);
      }

      return entries;
    } catch (err) {
      this.logger.error(
        { filePath, error: String(err) },
        'Failed to read log file',
      );
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // SSE streaming
  // ---------------------------------------------------------------------------

  /**
   * Watch log directory for new entries matching the given name.
   * Always watches today's files. Returns an abort function.
   */
  watchLogs(
    name: string,
    onNewEntry: (entry: LogEntryDto) => void,
  ): () => void {
    const dir = this.logDir;

    if (!fs.existsSync(dir)) {
      this.logger.warn({ dir }, 'Log directory not found for watching');
      return () => {};
    }

    const fileStates = new Map<string, FileWatchState>();
    let closed = false;

    const getTodayDate = () => {
      const now = new Date();
      return now.toISOString().slice(0, 10);
    };

    /**
     * Check if a filename matches the current name + today's date filter.
     */
    const matchesFilter = (filename: string): boolean => {
      if (filename.includes('.error.')) return false;
      const info = this.parseLogFilename(filename);
      if (!info) return false;
      if (info.date !== getTodayDate()) return false;
      if (name !== 'all' && info.name !== name) return false;
      return true;
    };

    /**
     * Initialize file state — seek to end so we only get new entries.
     */
    const initFileState = (filename: string) => {
      if (fileStates.has(filename)) return;
      const filePath = path.join(dir, filename);
      try {
        const stat = fs.statSync(filePath);
        fileStates.set(filename, { offset: stat.size, remainder: '' });
      } catch {
        fileStates.set(filename, { offset: 0, remainder: '' });
      }
    };

    /**
     * Read new bytes from a file and emit parsed entries.
     */
    const processFileChanges = (filename: string) => {
      if (closed) return;
      const filePath = path.join(dir, filename);
      const info = this.parseLogFilename(filename);
      if (!info) return;

      let state = fileStates.get(filename);
      if (!state) {
        state = { offset: 0, remainder: '' };
        fileStates.set(filename, state);
      }

      try {
        const stat = fs.statSync(filePath);

        // Handle truncation
        if (stat.size < state.offset) {
          state.offset = 0;
          state.remainder = '';
        }

        if (stat.size <= state.offset) return;

        // Read new bytes
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(stat.size - state.offset);
        fs.readSync(fd, buffer, 0, buffer.length, state.offset);
        fs.closeSync(fd);
        state.offset = stat.size;

        // Split into lines, preserving incomplete trailing line
        const raw = state.remainder + buffer.toString('utf-8');
        const lines = raw.split('\n');
        // Last element is either empty (if data ended with \n) or incomplete
        state.remainder = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const entry = this.parseLine(line, info.name);
          if (entry) {
            onNewEntry(entry);
          }
        }
      } catch (err) {
        if (!closed) {
          this.logger.error(
            { filename, error: String(err) },
            'Error reading log file changes',
          );
        }
      }
    };

    // Initialize states for existing matching files
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (matchesFilter(f)) {
          initFileState(f);
        }
      }
    } catch {
      // Directory read failed — watcher will pick up later
    }

    // Watch directory for changes
    const watcher = fs.watch(dir, (eventType, filename) => {
      if (closed || !filename) return;
      if (!matchesFilter(filename)) return;

      if (eventType === 'rename') {
        // New file appeared — initialize it
        initFileState(filename);
      }

      processFileChanges(filename);
    });

    // Periodic scan for new files (handles pino-roll count increment)
    const scanInterval = setInterval(() => {
      if (closed) return;
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (matchesFilter(f) && !fileStates.has(f)) {
            initFileState(f);
          }
        }
      } catch {
        // Ignore scan errors
      }
    }, 5000);

    return () => {
      closed = true;
      watcher.close();
      clearInterval(scanInterval);
    };
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Parse a single JSONL line into a LogEntryDto.
   * Extracts standard pino fields and bundles the rest into meta.
   */
  private parseLine(line: string, source?: string): LogEntryDto | null {
    try {
      const obj = JSON.parse(line);

      const { level, time, msg, context, correlationId, service, ...rest } =
        obj;

      const entry: LogEntryDto = {
        level: typeof level === 'number' ? level : 30,
        time: typeof time === 'number' ? time : Date.now(),
        msg: typeof msg === 'string' ? msg : String(msg ?? ''),
      };

      if (context) entry.context = String(context);
      if (correlationId) entry.correlationId = String(correlationId);
      if (service) entry.service = String(service);
      if (source) entry.source = source;

      // Bundle remaining fields as meta (excluding internal pino fields)
      // eslint-disable-next-line unused-imports/no-unused-vars
      const { pid, hostname, ...extraMeta } = rest;
      if (Object.keys(extraMeta).length > 0) {
        entry.meta = extraMeta;
      }

      return entry;
    } catch {
      return null;
    }
  }

  private encodeCursor(data: CursorData): string {
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }

  private decodeCursor(cursor: string): CursorData | null {
    try {
      const json = Buffer.from(cursor, 'base64url').toString('utf-8');
      const data = JSON.parse(json);
      if (typeof data.time === 'number' && typeof data.skip === 'number') {
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }
}
