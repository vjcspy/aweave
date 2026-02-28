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
      'Comma-separated topic names (e.g. "plans,features"). Each topic returns { overview_t1, entries }; decisions/lessons include full body_t1 per entry.',
  })
  topics?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Include defaults (scope_overview_t1, folder_structure, overviews, loaded_skills, decisions_t0, lessons_t0)',
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
