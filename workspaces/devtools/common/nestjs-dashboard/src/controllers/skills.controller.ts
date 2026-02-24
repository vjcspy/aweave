import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  ListSkillsResponseDto,
  SkillDto,
  ToggleSkillRequestDto,
  ToggleSkillResponseDto,
} from '../dtos/skills.dto';
import { SkillsService } from '../services/skills.service';

@ApiExtraModels(
  SkillDto,
  ListSkillsResponseDto,
  ToggleSkillRequestDto,
  ToggleSkillResponseDto,
)
@ApiTags('skills')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all available skills and their active status',
  })
  @ApiResponse({ status: 200, type: ListSkillsResponseDto })
  async listSkills(): Promise<ListSkillsResponseDto> {
    const allSkills = await this.skillsService.getAllSkills();

    const data = allSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      path: skill.path,
      active: skill.active === true,
    }));

    return {
      success: true,
      data,
    };
  }

  @Post(':skillId/toggle')
  @ApiOperation({ summary: 'Toggle active status of a skill' })
  @ApiResponse({ status: 200, type: ToggleSkillResponseDto })
  async toggleSkill(
    @Param('skillId') skillId: string,
    @Body() body: ToggleSkillRequestDto,
  ): Promise<ToggleSkillResponseDto> {
    // Note: In real app we might want to decode URL param if id contains path separators
    const decodedId = decodeURIComponent(skillId);

    await this.skillsService.setSkillActive(decodedId, body.active);

    const allSkills = await this.skillsService.getAllSkills();
    const skill = allSkills.find((s) => s.id === decodedId);

    if (!skill) {
      throw new Error(`Skill with ID ${decodedId} not found`);
    }

    return {
      success: true,
      data: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        path: skill.path,
        active: body.active,
      },
    };
  }
}
