import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDebateBodyDto {
  @ApiProperty() debate_id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ['coding_plan_debate', 'general_debate'] })
  debate_type!: string;
  @ApiProperty() motion_content!: string;
  @ApiProperty() client_request_id!: string;
}

export class SubmitArgumentBodyDto {
  @ApiProperty({ enum: ['proposer', 'opponent'] }) role!:
    | 'proposer'
    | 'opponent';
  @ApiProperty() target_id!: string;
  @ApiProperty() content!: string;
  @ApiProperty() client_request_id!: string;
}

export class SubmitAppealBodyDto {
  @ApiProperty() target_id!: string;
  @ApiProperty() content!: string;
  @ApiProperty() client_request_id!: string;
}

export class SubmitInterventionBodyDto {
  @ApiPropertyOptional() content?: string;
  @ApiPropertyOptional() client_request_id?: string;
}

export class SubmitRulingBodyDto {
  @ApiProperty() content!: string;
  @ApiPropertyOptional() close?: boolean;
  @ApiPropertyOptional() client_request_id?: string;
}

export class RequestCompletionBodyDto {
  @ApiProperty() target_id!: string;
  @ApiProperty() content!: string;
  @ApiProperty() client_request_id!: string;
}
