import { ApiProperty } from '@nestjs/swagger';

import { ArgumentDto } from './argument.dto';
import { DebateDto } from './debate.dto';

// ── Data shapes ──

export class ListDebatesDataDto {
  @ApiProperty({ type: [DebateDto] }) debates!: DebateDto[];
  @ApiProperty() total!: number;
}

export class GetDebateDataDto {
  @ApiProperty() debate!: DebateDto;
  @ApiProperty({ nullable: true, type: ArgumentDto })
  motion!: ArgumentDto | null;
  @ApiProperty({ type: [ArgumentDto] }) arguments!: ArgumentDto[];
}

export class WriteResultDataDto {
  @ApiProperty() debate!: DebateDto;
  @ApiProperty() argument!: ArgumentDto;
}

export class PollArgumentDataDto {
  @ApiProperty() id!: string;
  @ApiProperty() seq!: number;
  @ApiProperty({
    enum: ['MOTION', 'CLAIM', 'APPEAL', 'RULING', 'INTERVENTION', 'RESOLUTION'],
  })
  type!: string;
  @ApiProperty({ enum: ['proposer', 'opponent', 'arbitrator'] }) role!: string;
  @ApiProperty({ nullable: true, type: String }) parent_id!: string | null;
  @ApiProperty() content!: string;
  @ApiProperty() created_at!: string;
}

export class PollResultNewDataDto {
  @ApiProperty({ example: true }) has_new_argument!: true;
  @ApiProperty() action!: string;
  @ApiProperty() debate_state!: string;
  @ApiProperty() argument!: PollArgumentDataDto;
}

export class PollResultNoNewDataDto {
  @ApiProperty({ example: false }) has_new_argument!: false;
  @ApiProperty() debate_id!: string;
  @ApiProperty() last_seen_seq!: number;
}

// ── Concrete response envelopes ──

export class ListDebatesResponseDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty() data!: ListDebatesDataDto;
}

export class GetDebateResponseDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty() data!: GetDebateDataDto;
}

export class WriteResultResponseDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty() data!: WriteResultDataDto;
}

export class PollResultNewResponseDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty() data!: PollResultNewDataDto;
}

export class PollResultNoNewResponseDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty() data!: PollResultNoNewDataDto;
}
