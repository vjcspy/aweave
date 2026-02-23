/* eslint-disable @typescript-eslint/no-floating-promises */
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

  // Schemas are discovered automatically via @ApiExtraModels() decorators
  // on feature controllers (DebateController, ConfigsController, etc.)
  const document = SwaggerModule.createDocument(app, config);
  const outputPath = resolve(process.cwd(), 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`Generated ${outputPath}`);
  await app.close();
}

generate();
