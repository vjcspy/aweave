import {
  ArgumentDto,
  DebateDto,
  ErrorResponseDto,
  GetDebateResponseDto,
  ListDebatesResponseDto,
  PollResultNewResponseDto,
  PollResultNoNewResponseDto,
  WriteResultResponseDto,
} from '@aweave/nestjs-debate';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { AppExceptionFilter } from './shared/filters/app-exception.filter';
import { AuthGuard } from './shared/guards/auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // WebSocket adapter (ws library)
  app.useWebSocketAdapter(new WsAdapter(app));

  // CORS for debate-web and other clients
  app.enableCors({
    origin: '*',
    methods: 'GET,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });

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

  const port = parseInt(process.env.SERVER_PORT || '3456', 10);
  const host = process.env.SERVER_HOST || '127.0.0.1';

  await app.listen(port, host);
  console.log(`Server listening on http://${host}:${port}`);
}

bootstrap();
