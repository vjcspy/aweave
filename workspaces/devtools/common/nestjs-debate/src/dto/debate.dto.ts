import { ApiProperty } from '@nestjs/swagger';

export class DebateDto {
  @ApiProperty({ description: 'UUID' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: ['coding_plan_debate', 'general_debate'] })
  debate_type!: string;

  @ApiProperty({
    enum: [
      'AWAITING_OPPONENT',
      'AWAITING_PROPOSER',
      'AWAITING_ARBITRATOR',
      'INTERVENTION_PENDING',
      'CLOSED',
    ],
  })
  state!: string;

  @ApiProperty({ description: 'ISO datetime' })
  created_at!: string;

  @ApiProperty({ description: 'ISO datetime' })
  updated_at!: string;
}
