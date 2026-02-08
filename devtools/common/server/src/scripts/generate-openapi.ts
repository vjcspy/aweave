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
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

import { AppModule } from '../app.module';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Aweave Server API')
    .setVersion('1.0')
    .build();

  // Pass the same extraModels as main.ts to guarantee all $ref targets are emitted
  const document = SwaggerModule.createDocument(app, config, {
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
  const outputPath = resolve(process.cwd(), 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`Generated ${outputPath}`);
  await app.close();
}

generate();
