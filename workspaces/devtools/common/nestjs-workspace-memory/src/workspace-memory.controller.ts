import {
  Controller,
  DefaultValuePipe,
  Get,
  Logger,
  ParseBoolPipe,
  Query,
} from '@nestjs/common';
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
  private readonly logger = new Logger(WorkspaceMemoryController.name);

  constructor(private readonly service: WorkspaceMemoryService) {}

  @ApiOperation({ summary: 'Get workspace context' })
  @ApiOkResponse({ type: GetContextResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid scope or parameters' })
  @Get('context')
  async getContext(
    @Query() query: GetContextQueryDto,
    @Query('include_defaults', new DefaultValuePipe(true), ParseBoolPipe)
    includeDefaults: boolean,
  ) {
    if (!query.workspace) {
      this.logger.warn('getContext called without workspace param');
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'workspace is required' },
      };
    }

    this.logger.debug(
      { workspace: query.workspace, domain: query.domain },
      'getContext request',
    );

    const topics = this.service.parseTopics(query.topics);

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
