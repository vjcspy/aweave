import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { TailLogsResponseDto } from '../dtos/logs.dto';
import { LogsService } from '../services/logs.service';

@ApiTags('logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /**
   * GET /logs/tail — return last N log entries as JSON array.
   */
  @Get('tail')
  @ApiOperation({ summary: 'Get last N log entries from server.jsonl' })
  @ApiQuery({
    name: 'lines',
    required: false,
    type: Number,
    description: 'Number of lines to tail (default: 200, max: 2000)',
  })
  @ApiResponse({ status: 200, type: TailLogsResponseDto })
  tailLogs(@Query('lines') linesParam?: string): TailLogsResponseDto {
    const lines = Math.min(
      Math.max(parseInt(linesParam ?? '200', 10) || 200, 1),
      2000,
    );
    const result = this.logsService.tailLogs(lines);
    return {
      success: true,
      data: result.entries,
      totalLines: result.totalLines,
    };
  }

  /**
   * GET /logs/stream — Server-Sent Events stream of new log entries.
   * Each event is a JSON-serialized LogEntryDto.
   */
  @Get('stream')
  @ApiOperation({
    summary: 'Stream new log entries via Server-Sent Events (SSE)',
  })
  streamLogs(@Res() res: Response) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Send initial heartbeat
    res.write('event: connected\ndata: {}\n\n');

    // Watch for new log entries
    const stopWatching = this.logsService.watchLogs((entry) => {
      try {
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
      } catch {
        // Client disconnected
        stopWatching();
      }
    });

    // Send periodic keepalive (every 30s)
    const keepalive = setInterval(() => {
      try {
        res.write(':keepalive\n\n');
      } catch {
        clearInterval(keepalive);
        stopWatching();
      }
    }, 30_000);

    // Cleanup on disconnect
    res.on('close', () => {
      clearInterval(keepalive);
      stopWatching();
    });
  }
}
