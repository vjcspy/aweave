import { Controller, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { McpToolsService } from './mcp-tools.service';

@ApiExcludeController()
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpTools: McpToolsService) {}

  @Post()
  async handle(@Req() req: any, @Res() res: any) {
    await this.mcpTools.handleRequest(req, res);
  }
}
