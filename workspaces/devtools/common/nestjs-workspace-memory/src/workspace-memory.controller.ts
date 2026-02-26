import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';

import {
  GetContextQueryDto,
  GetContextResponseDto,
  SaveMemoryBodyDto,
  SaveMemoryResponseDto,
} from './dto';
import { WorkspaceMemoryService } from './workspace-memory.service';

@ApiExtraModels(GetContextResponseDto, SaveMemoryResponseDto)
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

  @ApiOperation({ summary: 'Save a decision or lesson' })
  @ApiOkResponse({ type: SaveMemoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid parameters' })
  @Post('memory')
  saveMemory(@Body() body: SaveMemoryBodyDto) {
    if (!body.workspace || !body.type || !body.title || !body.content) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'workspace, type, title, and content are required',
        },
      };
    }

    const result = this.service.saveMemory({
      scope: { workspace: body.workspace, domain: body.domain },
      type: body.type,
      title: body.title,
      content: body.content,
      category: body.category,
      tags: body.tags,
    });

    return { success: true, data: result };
  }
}
