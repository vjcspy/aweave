import { Controller, Get, Query, Res } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import {
  ListLogSourcesResponseDto,
  LogEntryDto,
  LogSourceDto,
  PaginationDto,
  QueryLogsResponseDto,
} from '../dtos/logs.dto';
import { LogsService } from '../services/logs.service';

@ApiExtraModels(
  LogEntryDto,
  LogSourceDto,
  PaginationDto,
  ListLogSourcesResponseDto,
  QueryLogsResponseDto,
)
@ApiTags('logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /**
   * GET /logs/sources — list available log source names and their date ranges.
   */
  @Get('sources')
  @ApiOperation({ summary: 'List discovered log sources with date ranges' })
  @ApiResponse({ status: 200, type: ListLogSourcesResponseDto })
  listSources(): ListLogSourcesResponseDto {
    const sourceMap = this.logsService.scanLogDirectory();

    const data: LogSourceDto[] = [];
    for (const [name, dateSet] of sourceMap) {
      const dates = Array.from(dateSet).sort().reverse();
      data.push({
        name,
        dates,
        latestDate: dates[0] ?? '',
      });
    }

    // Sort names alphabetically
    data.sort((a, b) => a.name.localeCompare(b.name));

    return { success: true, data };
  }

  /**
   * GET /logs/query — query log entries with cursor-based pagination.
   * Default (no cursor) returns the latest entries (tail behavior).
   */
  @Get('query')
  @ApiOperation({
    summary: 'Query log entries with filters and cursor pagination',
  })
  @ApiQuery({
    name: 'name',
    required: true,
    description: 'Log source name or "all"',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    description: 'Date in YYYY-MM-DD format',
  })
  @ApiQuery({
    name: 'level',
    required: false,
    description: 'Minimum level: trace/debug/info/warn/error/fatal',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Case-insensitive substring match on msg',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Opaque cursor from previous response for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max entries to return (default: 500, max: 2000)',
  })
  @ApiResponse({ status: 200, type: QueryLogsResponseDto })
  queryLogs(
    @Query('name') name: string,
    @Query('date') date: string,
    @Query('level') level?: string,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitParam?: string,
  ): QueryLogsResponseDto {
    const limit = limitParam ? parseInt(limitParam, 10) || 500 : 500;

    const result = this.logsService.queryLogs(name, date, {
      level,
      search,
      cursor,
      limit,
    });

    return {
      success: true,
      data: result.entries,
      pagination: {
        limit,
        returned: result.entries.length,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      },
    };
  }

  /**
   * GET /logs/stream — Server-Sent Events stream of new log entries.
   * Accepts `name` param to filter which log sources to watch.
   * Always watches today's files. Frontend must not connect for historical dates.
   */
  @Get('stream')
  @ApiOperation({
    summary: 'Stream new log entries via SSE (always watches today)',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    description: 'Log source name or "all" (default: "all")',
  })
  streamLogs(@Query('name') name: string = 'all', @Res() res: Response) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial heartbeat
    res.write('event: connected\ndata: {}\n\n');

    // Watch for new log entries
    const stopWatching = this.logsService.watchLogs(name, (entry) => {
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
