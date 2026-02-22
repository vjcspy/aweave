import { Module } from '@nestjs/common';

import { ConfigsController } from './controllers/configs.controller';
import { LogsController } from './controllers/logs.controller';
import { SkillsController } from './controllers/skills.controller';
import { ConfigsService } from './services/configs.service';
import { LogsService } from './services/logs.service';
import { SkillsService } from './services/skills.service';

@Module({
  imports: [],
  controllers: [ConfigsController, SkillsController, LogsController],
  providers: [ConfigsService, SkillsService, LogsService],
})
export class DashboardModule {}
