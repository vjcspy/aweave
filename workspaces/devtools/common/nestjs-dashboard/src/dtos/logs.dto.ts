import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogEntryDto {
  @ApiProperty({
    description:
      'Pino log level number (10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal)',
  })
  level!: number;

  @ApiProperty({ description: 'Unix timestamp in milliseconds' })
  time!: number;

  @ApiProperty({ description: 'Log message' })
  msg!: string;

  @ApiPropertyOptional({ description: 'NestJS context (class/module name)' })
  context?: string;

  @ApiPropertyOptional({ description: 'Correlation ID for request tracing' })
  correlationId?: string;

  @ApiPropertyOptional({ description: 'Service name' })
  service?: string;

  @ApiPropertyOptional({
    description: 'Log file source name (useful when name=all)',
  })
  source?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  meta?: Record<string, unknown>;
}

export class LogSourceDto {
  @ApiProperty({ description: 'Log source name (e.g. nestjs-server, cli)' })
  name!: string;

  @ApiProperty({
    description: 'Available dates in YYYY-MM-DD format, sorted descending',
    type: [String],
  })
  dates!: string[];

  @ApiProperty({ description: 'Most recent date with log entries' })
  latestDate!: string;
}

export class PaginationDto {
  @ApiProperty({ description: 'Max entries requested' })
  limit!: number;

  @ApiProperty({ description: 'Number of entries actually returned' })
  returned!: number;

  @ApiProperty({ description: 'Whether older entries exist before this page' })
  hasMore!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for fetching the next (older) page',
  })
  nextCursor!: string | null;
}

export class ListLogSourcesResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: [LogSourceDto] })
  data!: LogSourceDto[];
}

export class QueryLogsResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: [LogEntryDto] })
  data!: LogEntryDto[];

  @ApiProperty({ type: PaginationDto })
  pagination!: PaginationDto;
}
