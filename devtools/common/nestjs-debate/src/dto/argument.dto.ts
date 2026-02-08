import { ApiProperty } from '@nestjs/swagger';

export class ArgumentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  debate_id!: string;

  @ApiProperty({ nullable: true, type: String })
  parent_id!: string | null;

  @ApiProperty({
    enum: ['MOTION', 'CLAIM', 'APPEAL', 'RULING', 'INTERVENTION', 'RESOLUTION'],
  })
  type!: string;

  @ApiProperty({ enum: ['proposer', 'opponent', 'arbitrator'] })
  role!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ nullable: true, type: String })
  client_request_id!: string | null;

  @ApiProperty()
  seq!: number;

  @ApiProperty({ description: 'ISO datetime' })
  created_at!: string;
}
