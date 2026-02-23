/**
 * aw dashboard logs — Live server log stream (server.jsonl tail).
 *
 * Standalone panel: renders LogsPanel only.
 * Supports --format json for non-interactive output.
 * Supports --service to filter by structured log `service` field.
 */

import { Command, Flags } from '@oclif/core';

import {
  createFileTailStream,
  getDefaultServerJsonlPath,
} from '../../lib/file-tail.js';

export class DashboardLogs extends Command {
  static description = 'Show live server log stream from ~/.aweave/logs/server.jsonl';

  static flags = {
    lines: Flags.integer({
      description: 'Number of lines to show',
      default: 50,
    }),
    service: Flags.string({
      description: 'Filter by structured log service field',
    }),
    format: Flags.string({
      description: 'Output format',
      options: ['json'],
    }),
  };

  async run() {
    const { flags } = await this.parse(DashboardLogs);

    if (flags.format === 'json') {
      await this.outputJson(flags.service, flags.lines);
      return;
    }

    // Interactive Ink rendering
    const { render } = await import('ink');
    const React = await import('react');
    const { LogsPanel } = await import('../../components/panels/LogsPanel.js');

    render(
      React.createElement(LogsPanel, {
        maxLines: flags.lines,
        serviceName: flags.service,
      }),
    );
  }

  private async outputJson(
    serviceName?: string,
    maxLines?: number,
  ): Promise<void> {
    const lineLimit = Math.max(1, maxLines ?? 50);
    const filePath = getDefaultServerJsonlPath();
    const stream = createFileTailStream({
      filePath,
      initialLines: lineLimit,
    });

    await new Promise<void>((resolve, reject) => {
      let emittedCount = 0;

      const cleanup = () => {
        stream.emitter.off('line', onLine);
        stream.emitter.off('error', onError);
        stream.emitter.off('close', onClose);
        process.off('SIGINT', onSigint);
        stream.stop();
      };

      const maybeFinish = () => {
        if (emittedCount >= lineLimit) {
          cleanup();
          resolve();
        }
      };

      const onLine = (rawLine: string) => {
        const normalized = normalizeJsonOutput(rawLine);

        if (serviceName && normalized.service !== serviceName) {
          return;
        }

        this.log(
          JSON.stringify({
            timestamp: normalized.timestamp,
            service: normalized.service,
            level: normalized.level,
            message: normalized.message,
            raw: normalized.raw,
          }),
        );

        emittedCount++;
        maybeFinish();
      };

      const onError = (err: Error) => {
        cleanup();
        reject(new Error(`Log stream error (${filePath}): ${err.message}`));
      };

      const onClose = () => {
        if (emittedCount >= lineLimit) {
          resolve();
          return;
        }
      };

      const onSigint = () => {
        cleanup();
        resolve();
      };

      stream.emitter.on('line', onLine);
      stream.emitter.on('error', onError);
      stream.emitter.on('close', onClose);
      process.on('SIGINT', onSigint);
    });
  }
}

function normalizeJsonOutput(rawLine: string): {
  timestamp: string;
  service: string;
  level: string;
  message: string;
  raw: string;
} {
  const parsed = tryParseJsonRecord(rawLine);
  if (!parsed) {
    return {
      timestamp: new Date().toISOString(),
      service: 'aweave-server',
      level: 'unknown',
      message: rawLine,
      raw: rawLine,
    };
  }

  const timestamp = parseTimestamp(parsed.time)?.toISOString() ?? new Date().toISOString();
  const service =
    typeof parsed.service === 'string' ? parsed.service : 'aweave-server';
  const message =
    typeof parsed.msg === 'string'
      ? parsed.msg
      : typeof parsed.message === 'string'
        ? parsed.message
        : rawLine;
  const level = normalizeLevel(parsed.level);

  return { timestamp, service, level, message, raw: rawLine };
}

function tryParseJsonRecord(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fallback to raw line
  }

  return null;
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function normalizeLevel(value: unknown): string {
  if (typeof value === 'number') {
    if (value >= 60) return 'fatal';
    if (value >= 50) return 'error';
    if (value >= 40) return 'warn';
    if (value >= 30) return 'info';
    if (value >= 20) return 'debug';
    if (value >= 10) return 'trace';
    return 'unknown';
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.toLowerCase();
  }

  return 'unknown';
}
