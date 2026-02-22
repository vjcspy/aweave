import { ApiProperty } from '@nestjs/swagger';

export class SkillDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ description: 'Absolute path to the SKILL.md file' })
  path!: string;

  @ApiProperty({ description: 'Whether the skill is active (based on ~/.aweave/active-skills.json)' })
  active!: boolean;
}

export class ListSkillsResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: [SkillDto] })
  data!: SkillDto[];
}

export class ToggleSkillRequestDto {
  @ApiProperty()
  active!: boolean;
}

export class ToggleSkillResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: SkillDto })
  data!: SkillDto;
}
