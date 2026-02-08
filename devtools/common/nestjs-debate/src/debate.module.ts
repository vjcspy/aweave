import { Module, OnModuleInit } from '@nestjs/common';

import { ArgumentService } from './argument.service';
import { DebateController } from './debate.controller';
import { DebateGateway } from './debate.gateway';
import { DebateService } from './debate.service';
import { DebatePrismaService } from './debate-prisma.service';
import { LockService } from './lock.service';
import { serializeArgument, serializeDebate } from './serializers';

@Module({
  providers: [
    DebatePrismaService,
    LockService,
    DebateService,
    ArgumentService,
    DebateGateway,
  ],
  controllers: [DebateController],
  exports: [DebateService, ArgumentService],
})
export class DebateModule implements OnModuleInit {
  constructor(
    private readonly debateService: DebateService,
    private readonly argumentService: ArgumentService,
    private readonly gateway: DebateGateway,
  ) {}

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
          debate: serializeDebate(result.debate as any) as unknown as Record<
            string,
            unknown
          >,
          arguments: args.map((arg) =>
            serializeArgument(arg as any),
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
