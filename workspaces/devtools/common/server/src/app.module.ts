import {
  CorrelationIdMiddleware,
  NestjsCoreModule,
} from '@hod/aweave-nestjs-core';
import { DashboardModule } from '@hod/aweave-nestjs-dashboard';
import { DebateModule } from '@hod/aweave-nestjs-debate';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { DashboardSpaController } from './dashboard-spa.controller';
import { DebateSpaController } from './debate-spa.controller';
import { RootRedirectController } from './root-redirect.controller';
import { AppExceptionFilter } from './shared/filters/app-exception.filter';

@Module({
  imports: [NestjsCoreModule, DebateModule, DashboardModule],
  controllers: [
    DebateSpaController,
    DashboardSpaController,
    RootRedirectController,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Register correlation ID middleware for all HTTP routes
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
