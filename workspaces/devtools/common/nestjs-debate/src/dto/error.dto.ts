import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorDetailDto {
  @ApiProperty({
    example: 'VALIDATION_ERROR',
    description:
      'Error code (NOT_FOUND, INVALID_INPUT, ACTION_NOT_ALLOWED, etc.)',
  })
  code!: string;

  @ApiProperty({ example: 'Invalid debate_id format' })
  message!: string;

  @ApiPropertyOptional({ description: 'Suggested action to fix the error' })
  suggestion?: string;

  @ApiPropertyOptional({
    description: 'Current debate state (present in ACTION_NOT_ALLOWED errors)',
  })
  current_state?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Roles allowed for this action (present in ACTION_NOT_ALLOWED errors)',
  })
  allowed_roles?: string[];
}

export class ErrorResponseDto {
  @ApiProperty({ example: false }) success!: boolean;
  @ApiProperty() error!: ErrorDetailDto;
}
