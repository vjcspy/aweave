/**
 * Serialize domain models to snake_case JSON for backward compatibility
 * with the CLI and existing API contract.
 *
 * Domain types use camelCase (debateType, createdAt) but the API uses
 * snake_case (debate_type, created_at) to match the database column names.
 */

import type { Argument, Debate } from './database.service';

export interface SerializedDebate {
  id: string;
  title: string;
  debate_type: string;
  state: string;
  created_at: string;
  updated_at: string;
}

export interface SerializedArgument {
  id: string;
  debate_id: string;
  parent_id: string | null;
  type: string;
  role: string;
  content: string;
  client_request_id: string | null;
  seq: number;
  created_at: string;
}

export function serializeDebate(debate: Debate): SerializedDebate {
  return {
    id: debate.id,
    title: debate.title,
    debate_type: debate.debateType,
    state: debate.state,
    created_at: debate.createdAt,
    updated_at: debate.updatedAt,
  };
}

export function serializeArgument(arg: Argument): SerializedArgument {
  return {
    id: arg.id,
    debate_id: arg.debateId,
    parent_id: arg.parentId,
    type: arg.type,
    role: arg.role,
    content: arg.content,
    client_request_id: arg.clientRequestId,
    seq: arg.seq,
    created_at: arg.createdAt,
  };
}
