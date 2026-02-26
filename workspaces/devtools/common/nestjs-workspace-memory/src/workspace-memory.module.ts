import { Module } from '@nestjs/common';

import { McpController } from './mcp.controller';
import { McpToolsService } from './mcp-tools.service';
import { WorkspaceMemoryController } from './workspace-memory.controller';
import { WorkspaceMemoryService } from './workspace-memory.service';

@Module({
  controllers: [WorkspaceMemoryController, McpController],
  providers: [WorkspaceMemoryService, McpToolsService],
  exports: [WorkspaceMemoryService],
})
export class WorkspaceMemoryModule {}
