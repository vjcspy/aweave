import { Module } from '@nestjs/common';
import { ConfigsController } from './controllers/configs.controller';
import { SkillsController } from './controllers/skills.controller';
import { ConfigsService } from './services/configs.service';
import { SkillsService } from './services/skills.service';

@Module({
  imports: [],
  controllers: [ConfigsController, SkillsController],
  providers: [ConfigsService, SkillsService],
})
export class DashboardModule {}
