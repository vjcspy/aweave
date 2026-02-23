/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-floating-promises */
import {
  DEFAULT_CONFIG_DIR,
  DOMAIN,
  SERVER_ENV_OVERRIDES,
} from '@hod/aweave-config-common';
import { loadConfig } from '@hod/aweave-config-core';
import { NestLoggerService } from '@hod/aweave-nestjs-core';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { AuthGuard } from './shared/guards/auth.guard';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Use custom pino-backed logger for all Nest logs
  const logger = app.get(NestLoggerService);
  app.useLogger(logger);

  // WebSocket adapter (ws library)
  app.useWebSocketAdapter(new WsAdapter(app));

  // CORS config — disabled in production (frontend is same-origin via ServeStaticModule).
  // In dev mode, Rsbuild proxy handles cross-origin requests, so CORS is optional.
  if (process.env.NODE_ENV !== 'production') {
    app.enableCors({
      origin: '*',
      methods: 'GET,POST,DELETE,OPTIONS',
      allowedHeaders: 'Content-Type,Authorization,x-correlation-id',
    });
  }

  // Increase JSON body limit for log import (default ~100KB is too small)
  app.useBodyParser('json', { limit: '50mb' });

  // Swagger setup — schemas are discovered automatically via @ApiExtraModels()
  // decorators on feature controllers (DebateController, ConfigsController, etc.)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aweave Server API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Serve Swagger UI in dev
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api-docs', app, document);
  }

  // Global exception filter — DI-based so it can access LogContextService
  // Note: AppExceptionFilter is now registered as APP_FILTER provider in AppModule
  // No need for app.useGlobalFilters() here

  // Global auth guard (optional bearer token)
  app.useGlobalGuards(new AuthGuard());

  // Load config: defaults → user override (~/.aweave/config/common/server.yaml) → env vars
  const config = loadConfig({
    domain: DOMAIN,
    name: 'server',
    defaultsDir: DEFAULT_CONFIG_DIR,
    envOverrides: SERVER_ENV_OVERRIDES,
  });

  const port = (config as any).server?.port ?? 3456;
  const host = (config as any).server?.host ?? '127.0.0.1';

  await app.listen(port, host);
  logger.log(`Server listening on http://${host}:${port}`, 'Bootstrap');
}

bootstrap();
