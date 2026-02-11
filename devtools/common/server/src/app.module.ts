import { DebateModule } from '@aweave/nestjs-debate';
import { Module } from '@nestjs/common';

import { DebateSpaController } from './debate-spa.controller';
import { RootRedirectController } from './root-redirect.controller';

@Module({
  imports: [DebateModule],
  controllers: [DebateSpaController, RootRedirectController],
})
export class AppModule {}
