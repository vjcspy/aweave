import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';

import { GetContextQueryDto, GetContextResponseDto } from './dto';
import { WorkspaceMemoryService } from './workspace-memory.service';

@ApiExtraModels(GetContextResponseDto)
@Controller('workspace')
export class WorkspaceMemoryController {
  constructor(private readonly service: WorkspaceMemoryService) {}

  @ApiOperation({ summary: 'Get workspace context' })
  @ApiOkResponse({ type: GetContextResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid scope or parameters' })
  @Get('context')
  async getContext(@Query() query: GetContextQueryDto) {
    if (!query.workspace) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'workspace is required' },
      };
    }

    const topics = this.service.parseTopics(query.topics);
    const includeDefaults = query.include_defaults !== false;

    const result = await this.service.getContext({
      scope: {
        workspace: query.workspace,
        domain: query.domain,
        repository: query.repository,
      },
      topics,
      includeDefaults,
      filters: {
        status: query.filter_status?.split(',').map((s) => s.trim()),
        tags: query.filter_tags?.split(',').map((t) => t.trim()),
        category: query.filter_category,
      },
    });

    return { success: true, data: result };
  }
}
