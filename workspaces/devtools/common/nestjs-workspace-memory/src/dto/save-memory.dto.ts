import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveMemoryBodyDto {
  @ApiProperty({ description: 'Workspace name' })
  workspace!: string;

  @ApiPropertyOptional({ description: 'Domain within workspace' })
  domain?: string;

  @ApiProperty({ enum: ['decision', 'lesson'] })
  type!: 'decision' | 'lesson';

  @ApiProperty({ description: 'Entry title' })
  title!: string;

  @ApiProperty({ description: 'Entry content' })
  content!: string;

  @ApiPropertyOptional({ description: 'Category classification' })
  category?: string;

  @ApiPropertyOptional({ type: [String], description: 'Tags for filtering' })
  tags?: string[];
}

export class SaveMemoryResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty()
  data!: {
    filePath: string;
    type: string;
    title: string;
  };
}
