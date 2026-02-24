import { applySpaMiddleware } from '@hod/aweave-nestjs-core';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { dirname, join } from 'path';

import { ConfigsController } from './controllers/configs.controller';
import { LogsController } from './controllers/logs.controller';
import { SkillsController } from './controllers/skills.controller';
import { ConfigsService } from './services/configs.service';
import { LogsService } from './services/logs.service';
import { SkillsService } from './services/skills.service';

/**
 * Resolve dashboard-web SPA dist directory.
 * Uses require.resolve from THIS module's context (needed for pnpm strict isolation).
 * Falls back to server/public/dashboard for legacy layout.
 */
function resolveDashboardWebRoot(): string | null {
  try {
    const pkgPath = require.resolve('@hod/aweave-dashboard-web/package.json');
    return join(dirname(pkgPath), 'dist');
  } catch {
    return join(__dirname, '..', '..', '..', 'server', 'public', 'dashboard');
  }
}

@Module({
  imports: [],
  controllers: [ConfigsController, SkillsController, LogsController],
  providers: [ConfigsService, SkillsService, LogsService],
})
export class DashboardModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const rootPath = resolveDashboardWebRoot();
    if (rootPath) {
      applySpaMiddleware(consumer, { rootPath, routePrefix: '/dashboard' });
    }
  }
}
