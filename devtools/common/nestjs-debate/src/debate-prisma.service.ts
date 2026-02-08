import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { PrismaClient } from '../generated/prisma';

const DEFAULT_DB_DIR = join(homedir(), '.aweave', 'db');
const DEFAULT_DB_NAME = 'debate.db';

@Injectable()
export class DebatePrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DebatePrismaService.name);

  constructor() {
    const dbDir = process.env.DEBATE_DB_DIR || DEFAULT_DB_DIR;
    const dbName = process.env.DEBATE_DB_NAME || DEFAULT_DB_NAME;
    mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, dbName);

    super({
      datasources: { db: { url: `file:${dbPath}` } },
    });

    this.logger.log(`Database path: ${dbPath}`);
  }

  async onModuleInit() {
    await this.$connect();
    // PRAGMA returns results, so use $queryRawUnsafe (not $executeRawUnsafe)
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await this.$queryRawUnsafe('PRAGMA foreign_keys = ON');
    this.logger.log('Connected to debate database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
