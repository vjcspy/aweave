import { DebateModule } from '@hod/aweave-nestjs-debate';
import { LogModule } from '@hod/aweave-nab-nestjs-tracing-log';
import { Module } from '@nestjs/common';

import { DebateSpaController } from './debate-spa.controller';
import { RootRedirectController } from './root-redirect.controller';
import { TracingLogSpaController } from './tracing-log-spa.controller';

@Module({
  imports: [DebateModule, LogModule],
  controllers: [
    DebateSpaController,
    TracingLogSpaController,
    RootRedirectController,
  ],
})
export class AppModule {}
