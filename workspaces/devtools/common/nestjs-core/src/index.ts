// Public API
export { LogContextService } from './logging/log-context.service';
export { createLogger } from './logging/logger.factory';
export { NestLoggerService } from './logging/nest-logger.service';
export { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
export { NestjsCoreModule } from './nestjs-core.module';
export type { SpaServeOptions } from './spa/spa-middleware';
export { applySpaMiddleware } from './spa/spa-middleware';
