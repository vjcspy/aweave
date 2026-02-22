import { Global, Module } from '@nestjs/common';

import { LogContextService } from './logging/log-context.service';
import { NestLoggerService } from './logging/nest-logger.service';

/**
 * Global module that provides shared logging and request context services.
 *
 * Because this is @Global(), LogContextService and NestLoggerService are
 * available for injection in all modules without explicit imports.
 */
@Global()
@Module({
  providers: [LogContextService, NestLoggerService],
  exports: [LogContextService, NestLoggerService],
})
export class NestjsCoreModule {}
