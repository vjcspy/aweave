import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkillsService } from '../services/skills.service';
import { ListSkillsResponseDto, ToggleSkillRequestDto, ToggleSkillResponseDto } from '../dtos/skills.dto';

@ApiTags('skills')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'List all available skills and their active status' })
  @ApiResponse({ status: 200, type: ListSkillsResponseDto })
  async listSkills(): Promise<ListSkillsResponseDto> {
    const allSkills = await this.skillsService.getAllSkills();
    const activeIds = new Set(this.skillsService.getActiveSkillIds());

    const data = allSkills.map((skill) => ({
      ...skill,
      active: activeIds.has(skill.id),
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
        ...skill,
        active: body.active,
      },
    };
  }
}
