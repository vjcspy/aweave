import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScopeDto {
  @ApiProperty({ description: 'Workspace name (e.g. "devtools")' })
  workspace!: string;

  @ApiPropertyOptional({ description: 'Domain within workspace' })
  domain?: string;

  @ApiPropertyOptional({ description: 'Repository within domain' })
  repository?: string;
}

export class FiltersDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Filter plans by status',
  })
  status?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Filter by tags' })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Filter decisions/lessons by category' })
  category?: string;
}

export class GetContextQueryDto {
  @ApiProperty({ description: 'Workspace name' })
  workspace!: string;

  @ApiPropertyOptional({ description: 'Domain within workspace' })
  domain?: string;

  @ApiPropertyOptional({ description: 'Repository within domain' })
  repository?: string;

  @ApiPropertyOptional({
    type: String,
    description:
      'Comma-separated topic names (auto-discovered from topics folder)',
  })
  topics?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Include default context (folder_structure, overviews, loaded_skills)',
    default: true,
  })
  include_defaults?: boolean;

  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated status filter for plans',
  })
  filter_status?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated tag filter',
  })
  filter_tags?: string;

  @ApiPropertyOptional({ description: 'Category filter' })
  filter_category?: string;
}

export class GetContextResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty()
  data!: Record<string, unknown>;
}
