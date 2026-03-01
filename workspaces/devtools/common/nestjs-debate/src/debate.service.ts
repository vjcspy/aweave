import type { DebateState } from '@hod/aweave-debate-machine';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import type { Argument } from './database.service';
import { DatabaseService } from './database.service';
import { DebateGateway } from './debate.gateway';
import {
  ContentTooLargeError,
  DebateNotFoundError,
  InvalidInputError,
} from './errors';
import { LockService } from './lock.service';
import { serializeArgument, serializeDebate } from './serializers';
import type { WaitAction, WaiterRole } from './types';

const MAX_CONTENT_LENGTH = 10 * 1024; // 10KB

function validateContentSize(content: string): void {
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new ContentTooLargeError(MAX_CONTENT_LENGTH);
  }
}

function buildWaitAction(
  argument: { type: string; role: string },
  debateState: string,
  waiterRole: WaiterRole,
): WaitAction {
  if (debateState === 'CLOSED') return 'debate_closed';

  const key = `${argument.type}:${argument.role}:${waiterRole}`;
  const map: Record<string, WaitAction> = {
    'CLAIM:opponent:proposer': 'respond',
    'CLAIM:proposer:opponent': 'respond',
    'APPEAL:proposer:proposer': 'wait_for_ruling',
    'APPEAL:proposer:opponent': 'wait_for_ruling',
    'RESOLUTION:proposer:proposer': 'wait_for_ruling',
    'RESOLUTION:proposer:opponent': 'wait_for_ruling',
    'RULING:arbitrator:proposer': 'align_to_ruling',
    'RULING:arbitrator:opponent': 'wait_for_proposer',
    'INTERVENTION:arbitrator:proposer': 'wait_for_ruling',
    'INTERVENTION:arbitrator:opponent': 'wait_for_ruling',
  };

  return map[key] || 'respond';
}

@Injectable()
export class DebateService {
  private readonly logger = new Logger(DebateService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly locks: LockService,
    private readonly gateway: DebateGateway,
  ) {}

  async createDebate(input: {
    debate_id: string;
    title: string;
    debate_type: string;
    motion_content: string;
    client_request_id: string;
  }) {
    this.logger.log(
      { debateId: input.debate_id, type: input.debate_type },
      'Creating debate',
    );
    validateContentSize(input.motion_content);

    const result = await this.locks.withLock(input.debate_id, async () => {
      return this.db.transaction(() => {
        // Idempotency: check if debate already exists
        const existingDebate = this.db.findDebateById(input.debate_id);

        if (existingDebate) {
          const existingMotion = this.db.findArgumentByDebateAndRequestId(
            input.debate_id,
            input.client_request_id,
          );
          if (!existingMotion) {
            throw new InvalidInputError(
              'Debate already exists with a different request',
              { debate_id: input.debate_id },
            );
          }
          return {
            debate: existingDebate,
            argument: existingMotion,
            isExisting: true,
          };
        }

        const debate = this.db.insertDebate({
          id: input.debate_id,
          title: input.title,
          debateType: input.debate_type,
          state: 'AWAITING_OPPONENT',
        });

        const argument = this.db.insertArgument({
          id: randomUUID(),
          debateId: input.debate_id,
          parentId: null,
          type: 'MOTION',
          role: 'proposer',
          content: input.motion_content,
          clientRequestId: input.client_request_id,
          seq: 1,
        });

        return { debate, argument, isExisting: false };
      });
    });

    if (!result.isExisting) {
      this.gateway.broadcastNewArgument(
        input.debate_id,
        serializeDebate(result.debate) as unknown as Record<string, unknown>,
        serializeArgument(result.argument) as unknown as Record<
          string,
          unknown
        >,
      );
    }

    return { debate: result.debate, argument: result.argument };
  }

  async getDebate(debateId: string) {
    const debate = this.db.findDebateById(debateId);
    if (!debate) throw new DebateNotFoundError(debateId);
    return debate;
  }

  async getDebateWithArgs(debateId: string, argumentLimit?: number) {
    const debate = await this.getDebate(debateId);

    const motion = this.db.findMotionByDebateId(debateId);

    let args: Argument[];
    if (argumentLimit === undefined) {
      args = this.db.findArgumentsExcludeMotionAsc(debateId, 10000);
    } else if (argumentLimit <= 0) {
      args = [];
    } else {
      const limit = Math.min(500, argumentLimit);
      // Get last N arguments (excluding motion), return in asc order
      const recent = this.db.findArgumentsExcludeMotionDesc(debateId, limit);
      args = recent.reverse();
    }

    return { debate, motion, arguments: args };
  }

  async listDebates(opts?: {
    state?: string;
    limit?: number;
    offset?: number;
    pendingFirstOpponent?: boolean;
  }) {
    const take = opts?.limit ?? 50;
    const skip = opts?.offset ?? 0;

    if (opts?.pendingFirstOpponent) {
      const debates = this.db.findDebatesPendingFirstOpponent(take, skip);
      const total = this.db.countDebatesPendingFirstOpponent();
      return { debates, total };
    }

    const debates = this.db.findDebates(opts?.state, take, skip);
    const total = this.db.countDebates(opts?.state);

    return { debates, total };
  }

  async deleteDebate(debateId: string) {
    this.logger.log({ debateId }, 'Deleting debate');
    await this.locks.withLock(debateId, async () => {
      const debate = this.db.findDebateById(debateId);
      if (!debate) throw new DebateNotFoundError(debateId);

      this.db.transaction(() => {
        this.db.deleteArgumentsByDebateId(debateId);
        this.db.deleteDebateById(debateId);
      });
    });
  }

  /**
   * Interval polling endpoint. Responds immediately.
   * Client is expected to poll every ~2s.
   */
  async poll(input: {
    debate_id: string;
    argument_id?: string | null;
    role: WaiterRole;
  }) {
    const debate = this.db.findDebateById(input.debate_id);
    if (!debate) throw new DebateNotFoundError(input.debate_id);

    let lastSeenSeq = 0;
    if (input.argument_id) {
      const lastSeenArg = this.db.findArgumentById(input.argument_id);
      if (!lastSeenArg || lastSeenArg.debateId !== input.debate_id) {
        throw new InvalidInputError(
          'argument_id does not belong to this debate',
          { debate_id: input.debate_id, argument_id: input.argument_id },
        );
      }
      lastSeenSeq = lastSeenArg.seq;
    }

    // Find the latest argument with seq > lastSeenSeq
    const latest = this.db.findLatestArgumentAfterSeq(
      input.debate_id,
      lastSeenSeq,
    );

    if (latest) {
      // Re-fetch debate to get current state (may have changed)
      const currentDebate = this.db.findDebateById(input.debate_id);
      const state = (currentDebate?.state ?? debate.state) as DebateState;

      return {
        has_new_argument: true,
        action: buildWaitAction(latest, state, input.role),
        debate_state: state,
        argument: {
          id: latest.id,
          seq: latest.seq,
          type: latest.type,
          role: latest.role,
          parent_id: latest.parentId,
          content: latest.content,
          created_at: latest.createdAt,
        },
      };
    }

    return {
      has_new_argument: false,
      debate_id: input.debate_id,
      last_seen_seq: lastSeenSeq,
    };
  }
}
