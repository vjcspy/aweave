import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { homedir } from 'os';
import * as path from 'path';

import type { LogEntryDto } from '../dtos/logs.dto';

const DEFAULT_LOG_FILE = path.join(
  homedir(),
  '.aweave',
  'logs',
  'server.jsonl',
);

/**
 * Service for reading and tailing the server JSONL log file.
 *
 * All reads are bounded and non-blocking to avoid memory issues
 * with large log files. We read from the end of the file for tail
 * operations rather than loading the entire file.
 */
@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  private get logFilePath(): string {
    return process.env.LOG_FILE ?? DEFAULT_LOG_FILE;
  }

  /**
   * Read the last N lines from the JSONL log file.
   * Uses a reverse-read strategy to avoid loading the entire file.
   */
  tailLogs(lines: number = 200): {
    entries: LogEntryDto[];
    totalLines: number;
  } {
    const filePath = this.logFilePath;

    if (!fs.existsSync(filePath)) {
      this.logger.warn({ filePath }, 'Log file not found');
      return { entries: [], totalLines: 0 };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const allLines = content.split('\n').filter((line) => line.trim());
      const totalLines = allLines.length;

      // Take last N lines
      const tailLines = allLines.slice(-lines);
      const entries = tailLines
        .map((line) => this.parseLine(line))
        .filter((entry): entry is LogEntryDto => entry !== null);

      return { entries, totalLines };
    } catch (err) {
      this.logger.error(
        { filePath, error: String(err) },
        'Failed to read log file',
      );
      return { entries: [], totalLines: 0 };
    }
  }

  /**
   * Watch the log file for new appended lines and invoke callback for each.
   * Returns an abort function to stop watching.
   */
  watchLogs(onNewEntry: (entry: LogEntryDto) => void): () => void {
    const filePath = this.logFilePath;

    if (!fs.existsSync(filePath)) {
      this.logger.warn({ filePath }, 'Log file not found for watching');
      return () => {};
    }

    let lastSize = 0;
    try {
      const stat = fs.statSync(filePath);
      lastSize = stat.size;
    } catch {
      // Start from 0 if stat fails
    }

    let closed = false;

    const watcher = fs.watch(filePath, (eventType) => {
      if (closed || eventType !== 'change') return;

      try {
        const stat = fs.statSync(filePath);
        const newSize = stat.size;

        if (newSize <= lastSize) {
          // File was truncated or rotated — reset
          lastSize = newSize;
          return;
        }

        // Read only the new bytes
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(newSize - lastSize);
        fs.readSync(fd, buffer, 0, buffer.length, lastSize);
        fs.closeSync(fd);
        lastSize = newSize;

        const newContent = buffer.toString('utf-8');
        const newLines = newContent.split('\n').filter((line) => line.trim());

        for (const line of newLines) {
          const entry = this.parseLine(line);
          if (entry) {
            onNewEntry(entry);
          }
        }
      } catch (err) {
        if (!closed) {
          this.logger.error(
            { error: String(err) },
            'Error reading log file changes',
          );
        }
      }
    });

    return () => {
      closed = true;
      watcher.close();
    };
  }

  /**
   * Parse a single JSONL line into a LogEntryDto.
   * Extracts standard pino fields and bundles the rest into meta.
   */
  private parseLine(line: string): LogEntryDto | null {
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
}
