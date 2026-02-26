import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { McpToolsService } from './mcp-tools.service';

@ApiExcludeController()
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpTools: McpToolsService) {}

  @Get('sse')
  async sse(@Req() req: any, @Res() res: any) {
    await this.mcpTools.handleSseConnection(req, res);
  }

  @Post('messages')
  async messages(
    @Req() req: any,
    @Res() res: any,
    @Query('sessionId') sessionId: string,
  ) {
    await this.mcpTools.handleMessage(req, res, sessionId);
  }
}
