import { applySpaMiddleware } from '@hod/aweave-nestjs-core';
import type { MiddlewareConsumer } from '@nestjs/common';
import type { NestModule } from '@nestjs/common';
import { Module, OnModuleInit } from '@nestjs/common';
import { dirname, join } from 'path';

import { ArgumentService } from './argument.service';
import { DatabaseService } from './database.service';
import { DebateController } from './debate.controller';
import { DebateGateway } from './debate.gateway';
import { DebateService } from './debate.service';
import { LockService } from './lock.service';
import { serializeArgument, serializeDebate } from './serializers';

/**
 * Resolve debate-web SPA dist directory.
 * Uses require.resolve from THIS module's context (needed for pnpm strict isolation).
 * Falls back to server/public/debate for legacy layout.
 */
function resolveDebateWebRoot(): string | null {
  try {
    const pkgPath = require.resolve('@hod/aweave-debate-web/package.json');
    return join(dirname(pkgPath), 'dist');
  } catch {
    // Fallback for legacy server/public layout
    return join(__dirname, '..', '..', '..', 'server', 'public', 'debate');
  }
}

@Module({
  providers: [
    DatabaseService,
    LockService,
    DebateService,
    ArgumentService,
    DebateGateway,
  ],
  controllers: [DebateController],
  exports: [DebateService, ArgumentService],
})
export class DebateModule implements OnModuleInit, NestModule {
  constructor(
    private readonly debateService: DebateService,
    private readonly argumentService: ArgumentService,
    private readonly gateway: DebateGateway,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    const rootPath = resolveDebateWebRoot();
    if (rootPath) {
      applySpaMiddleware(consumer, { rootPath, routePrefix: '/debate' });
    }
  }

  async onModuleInit() {
    // Wire up WebSocket gateway handlers to avoid circular dependency.
    // The gateway needs service methods for client-to-server events,
    // and the services need the gateway for broadcasting.
    // Services inject the gateway directly; gateway gets service callbacks here.
    this.gateway.setHandlers({
      getInitialState: async (debateId: string) => {
        const result = await this.debateService.getDebateWithArgs(debateId);
        const args = [];

        if (result.motion) {
          args.push(result.motion);
        }
        if (result.arguments) {
          args.push(...result.arguments);
        }

        return {
          debate: serializeDebate(result.debate) as unknown as Record<
            string,
            unknown
          >,
          arguments: args.map((arg) =>
            serializeArgument(arg),
          ) as unknown as Record<string, unknown>[],
        };
      },
      onSubmitIntervention: async (input) => {
        await this.argumentService.submitIntervention(input);
      },
      onSubmitRuling: async (input) => {
        await this.argumentService.submitRuling(input);
      },
    });
  }
}
