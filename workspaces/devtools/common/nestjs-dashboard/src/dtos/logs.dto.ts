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

  @ApiPropertyOptional({ description: 'Additional metadata' })
  meta?: Record<string, unknown>;
}

export class TailLogsResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: [LogEntryDto] })
  data!: LogEntryDto[];

  @ApiProperty({ description: 'Total lines in the log file' })
  totalLines!: number;
}
