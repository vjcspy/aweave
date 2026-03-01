import { Controller, Logger, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { McpToolsService } from './mcp-tools.service';

@ApiExcludeController()
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(private readonly mcpTools: McpToolsService) {}

  @Post()
  async handle(@Req() req: any, @Res() res: any) {
    this.logger.debug('Incoming MCP request');
    await this.mcpTools.handleRequest(req, res);
  }
}
