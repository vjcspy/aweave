import { DebateModule } from '@aweave/nestjs-debate';
import { Module } from '@nestjs/common';

@Module({
  imports: [DebateModule],
})
export class AppModule {}
