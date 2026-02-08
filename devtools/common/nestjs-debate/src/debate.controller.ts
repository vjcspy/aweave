import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  getSchemaPath,
} from '@nestjs/swagger';

import { ArgumentService } from './argument.service';
import { DebateService } from './debate.service';
import {
  CreateDebateBodyDto,
  ErrorResponseDto,
  GetDebateResponseDto,
  ListDebatesResponseDto,
  PollResultNewResponseDto,
  PollResultNoNewResponseDto,
  RequestCompletionBodyDto,
  SubmitAppealBodyDto,
  SubmitArgumentBodyDto,
  SubmitInterventionBodyDto,
  SubmitRulingBodyDto,
  WriteResultResponseDto,
} from './dto';
import { InvalidInputError } from './errors';
import { serializeArgument, serializeDebate } from './serializers';
import type { WaiterRole } from './types';

function ok<T>(data: T) {
  return { success: true as const, data };
}

// Helper to serialize debate+argument response (write operations)
function serializeWriteResult(result: { debate: any; argument: any }) {
  return {
    debate: serializeDebate(result.debate),
    argument: serializeArgument(result.argument),
  };
}

@ApiExtraModels(
  PollResultNewResponseDto,
  PollResultNoNewResponseDto,
  ErrorResponseDto,
)
@Controller()
export class DebateController {
  constructor(
    private readonly debateService: DebateService,
    private readonly argumentService: ArgumentService,
  ) {}

  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({ description: 'Server is healthy' })
  @Get('health')
  healthCheck() {
    return ok({ status: 'ok' });
  }

  @ApiOperation({ summary: 'List debates with optional filtering' })
  @ApiQuery({
    name: 'state',
    required: false,
    type: String,
    description: 'Filter by debate state',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max results to return',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Pagination offset',
  })
  @ApiOkResponse({
    type: ListDebatesResponseDto,
    description: 'List of debates',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @Get('debates')
  async listDebates(
    @Query('state') state?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
    const offset = offsetRaw ? parseInt(offsetRaw, 10) : undefined;

    if (limitRaw && (!Number.isFinite(limit) || (limit as number) < 0)) {
      throw new InvalidInputError('Invalid limit parameter');
    }
    if (offsetRaw && (!Number.isFinite(offset) || (offset as number) < 0)) {
      throw new InvalidInputError('Invalid offset parameter');
    }

    const result = await this.debateService.listDebates({
      state,
      limit,
      offset,
    });
    return ok({
      debates: result.debates.map(serializeDebate),
      total: result.total,
    });
  }

  @ApiOperation({ summary: 'Create a new debate with initial MOTION argument' })
  @ApiOkResponse({
    type: WriteResultResponseDto,
    description: 'Debate created',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @Post('debates')
  async createDebate(@Body() body: CreateDebateBodyDto) {
    if (
      !body.debate_id ||
      !body.title ||
      !body.debate_type ||
      !body.motion_content ||
      !body.client_request_id
    ) {
      throw new InvalidInputError('Missing required fields');
    }

    const result = await this.debateService.createDebate({
      debate_id: body.debate_id,
      title: body.title,
      debate_type: body.debate_type,
      motion_content: body.motion_content,
      client_request_id: body.client_request_id,
    });
    return ok(serializeWriteResult(result));
  }

  @ApiOperation({ summary: 'Get debate with motion and arguments' })
  @ApiParam({ name: 'id', description: 'Debate UUID', type: String })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max arguments to return',
  })
  @ApiOkResponse({ type: GetDebateResponseDto, description: 'Debate detail' })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Get('debates/:id')
  async getDebate(
    @Param('id') debateId: string,
    @Query('limit') limitRaw?: string,
  ) {
    let limit: number | undefined;
    if (limitRaw !== undefined) {
      limit = parseInt(limitRaw, 10);
      if (!Number.isFinite(limit)) {
        throw new InvalidInputError('Invalid limit parameter', {
          limit: limitRaw,
        });
      }
      if (limit < 0) {
        throw new InvalidInputError('limit must be non-negative', { limit });
      }
    }

    const result = await this.debateService.getDebateWithArgs(debateId, limit);
    return ok({
      debate: serializeDebate(result.debate),
      motion: result.motion ? serializeArgument(result.motion) : null,
      arguments: result.arguments.map(serializeArgument),
    });
  }

  @ApiOperation({ summary: 'Delete a debate and all its arguments' })
  @ApiParam({ name: 'id', description: 'Debate UUID', type: String })
  @ApiOkResponse({ description: 'Debate deleted' })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Delete('debates/:id')
  async deleteDebate(@Param('id') debateId: string) {
    await this.debateService.deleteDebate(debateId);
    return ok({ deleted: true });
  }

  @ApiOperation({ summary: 'Submit a CLAIM argument' })
  @ApiParam({ name: 'id', description: 'Debate UUID', type: String })
  @ApiOkResponse({
    type: WriteResultResponseDto,
    description: 'Argument submitted',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Action not allowed in current state',
  })
  @Post('debates/:id/arguments')
  async submitArgument(
    @Param('id') debateId: string,
    @Body() body: SubmitArgumentBodyDto,
  ) {
    if (
      !body.role ||
      !body.target_id ||
      !body.content ||
      !body.client_request_id
    ) {
      throw new InvalidInputError('Missing required fields');
    }

    const result = await this.argumentService.submitClaim({
      debate_id: debateId,
      role: body.role,
      target_id: body.target_id,
      content: body.content,
      client_request_id: body.client_request_id,
    });
    return ok(serializeWriteResult(result));
  }

  @ApiOperation({ summary: 'Submit an APPEAL' })
  @ApiParam({ name: 'id', description: 'Debate UUID', type: String })
  @ApiOkResponse({
    type: WriteResultResponseDto,
    description: 'Appeal submitted',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Action not allowed in current state',
  })
  @Post('debates/:id/appeal')
  async submitAppeal(
    @Param('id') debateId: string,
    @Body() body: SubmitAppealBodyDto,
  ) {
    if (!body.target_id || !body.content || !body.client_request_id) {
      throw new InvalidInputError('Missing required fields');
    }

    const result = await this.argumentService.submitAppeal({
      debate_id: debateId,
      target_id: body.target_id,
      content: body.content,
      client_request_id: body.client_request_id,
    });
    return ok(serializeWriteResult(result));
  }

  @ApiOperation({ summary: 'Request debate completion (RESOLUTION)' })
  @ApiParam({ name: 'id', description: 'Debate UUID', type: String })
  @ApiOkResponse({
    type: WriteResultResponseDto,
    description: 'Resolution submitted',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Action not allowed in current state',
  })
  @Post('debates/:id/resolution')
  async submitResolution(
    @Param('id') debateId: string,
    @Body() body: RequestCompletionBodyDto,
  ) {
    if (!body.target_id || !body.content || !body.client_request_id) {
      throw new InvalidInputError('Missing required fields');
    }

    const result = await this.argumentService.submitResolution({
      debate_id: debateId,
      target_id: body.target_id,
      content: body.content,
      client_request_id: body.client_request_id,
    });
    return ok(serializeWriteResult(result));
  }

  @ApiOperation({ summary: 'Submit an INTERVENTION (arbitrator only)' })
  @ApiParam({ name: 'id', description: 'Debate UUID', type: String })
  @ApiOkResponse({
    type: WriteResultResponseDto,
    description: 'Intervention submitted',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Action not allowed in current state',
  })
  @Post('debates/:id/intervention')
  async submitIntervention(
    @Param('id') debateId: string,
    @Body() body: SubmitInterventionBodyDto,
  ) {
    const result = await this.argumentService.submitIntervention({
      debate_id: debateId,
      content: body.content,
      client_request_id: body.client_request_id,
    });
    return ok(serializeWriteResult(result));
  }

  @ApiOperation({ summary: 'Submit a RULING (arbitrator only)' })
  @ApiParam({ name: 'id', description: 'Debate UUID', type: String })
  @ApiOkResponse({
    type: WriteResultResponseDto,
    description: 'Ruling submitted',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Action not allowed in current state',
  })
  @Post('debates/:id/ruling')
  async submitRuling(
    @Param('id') debateId: string,
    @Body() body: SubmitRulingBodyDto,
  ) {
    if (!body.content) {
      throw new InvalidInputError('Missing required fields');
    }

    const result = await this.argumentService.submitRuling({
      debate_id: debateId,
      content: body.content,
      close: body.close,
      client_request_id: body.client_request_id,
    });
    return ok(serializeWriteResult(result));
  }

  @ApiOperation({ summary: 'Long-poll for new arguments' })
  @ApiParam({ name: 'id', description: 'Debate UUID', type: String })
  @ApiQuery({
    name: 'argument_id',
    required: false,
    type: String,
    description: 'Last seen argument UUID',
  })
  @ApiQuery({ name: 'role', required: true, enum: ['proposer', 'opponent'] })
  @ApiOkResponse({
    description: 'Poll result — new argument or timeout',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(PollResultNewResponseDto) },
        { $ref: getSchemaPath(PollResultNoNewResponseDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Get('debates/:id/poll')
  async poll(
    @Param('id') debateId: string,
    @Query('argument_id') argumentId?: string,
    @Query('role') role?: string,
  ) {
    if (!role || (role !== 'proposer' && role !== 'opponent')) {
      throw new InvalidInputError('Invalid role', { role });
    }

    const result = await this.debateService.poll({
      debate_id: debateId,
      argument_id: argumentId || null,
      role: role as WaiterRole,
    });
    return ok(result);
  }
}
