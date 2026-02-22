import { DashboardModule } from '@hod/aweave-nestjs-dashboard';
import { DebateModule } from '@hod/aweave-nestjs-debate';
import { Module } from '@nestjs/common';

import { DashboardSpaController } from './dashboard-spa.controller';
import { DebateSpaController } from './debate-spa.controller';
import { RootRedirectController } from './root-redirect.controller';

@Module({
  imports: [DebateModule, DashboardModule],
  controllers: [DebateSpaController, DashboardSpaController, RootRedirectController],
})
export class AppModule {}
