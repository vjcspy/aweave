/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access */
import {
  DEFAULT_CONFIG_DIR,
  DOMAIN,
  SERVER_ENV_OVERRIDES,
} from '@hod/aweave-config-common';
import { loadConfig } from '@hod/aweave-config-core';
import {
  ArgumentDto,
  DebateDto,
  ErrorResponseDto,
  GetDebateResponseDto,
  ListDebatesResponseDto,
  PollResultNewResponseDto,
  PollResultNoNewResponseDto,
  WriteResultResponseDto,
} from '@hod/aweave-nestjs-debate';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { dirname, join } from 'path';

import { AppModule } from './app.module';
import { AppExceptionFilter } from './shared/filters/app-exception.filter';
import { AuthGuard } from './shared/guards/auth.guard';

/**
 * Resolve debate-web SPA static files directory.
 */
function resolveDebateWebRoot(): string {
  try {
    const pkgPath = require.resolve('@hod/aweave-debate-web/package.json');
    return join(dirname(pkgPath), 'dist');
  } catch {
    return join(__dirname, '..', 'public', 'debate');
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // WebSocket adapter (ws library)
  app.useWebSocketAdapter(new WsAdapter(app));

  // Serve debate-web SPA static files under /debate
  const debateWebRoot = resolveDebateWebRoot();
  app.useStaticAssets(debateWebRoot, { prefix: '/debate' });

  // CORS config — disabled in production (frontend is same-origin via ServeStaticModule).
  // In dev mode, Rsbuild proxy handles cross-origin requests, so CORS is optional.
  if (process.env.NODE_ENV !== 'production') {
    app.enableCors({
      origin: '*',
      methods: 'GET,POST,DELETE,OPTIONS',
      allowedHeaders: 'Content-Type,Authorization',
    });
  }

  // Increase JSON body limit for log import (default ~100KB is too small)
  app.useBodyParser('json', { limit: '50mb' });

  // Swagger setup (registers schemas for spec generation)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aweave Server API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    extraModels: [
      DebateDto,
      ArgumentDto,
      ListDebatesResponseDto,
      GetDebateResponseDto,
      WriteResultResponseDto,
      PollResultNewResponseDto,
      PollResultNoNewResponseDto,
      ErrorResponseDto,
    ],
  });

  // Serve Swagger UI in dev
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api-docs', app, document);
  }

  // Global exception filter (formats errors to { success, error } envelope)
  app.useGlobalFilters(new AppExceptionFilter());

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
  console.log(`Server listening on http://${host}:${port}`);
}

bootstrap();
