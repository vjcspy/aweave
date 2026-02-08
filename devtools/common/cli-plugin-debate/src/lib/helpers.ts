/**
 * Shared helpers for debate CLI commands.
 */

import { HTTPClient } from '@aweave/cli-shared';

import { DEBATE_AUTH_TOKEN, DEBATE_SERVER_URL } from './config';

export function getClient(timeout = 10_000): HTTPClient {
  const headers: Record<string, string> = {};
  if (DEBATE_AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${DEBATE_AUTH_TOKEN}`;
  }
  return new HTTPClient({ baseUrl: DEBATE_SERVER_URL, headers, timeout });
}

/**
 * Filter server response for write commands — strip content, keep only IDs/state/type/seq.
 * Token optimization: agent just submitted the content, doesn't need it echoed back.
 */
export function filterWriteResponse(
  serverData: Record<string, unknown>,
): Record<string, unknown> {
  const argument = (serverData.argument ?? {}) as Record<string, unknown>;
  const debate = (serverData.debate ?? {}) as Record<string, unknown>;

  return {
    argument_id: argument.id,
    argument_type: argument.type,
    argument_seq: argument.seq,
    debate_id: debate.id ?? argument.debate_id ?? serverData.debate_id,
    debate_state: debate.state ?? serverData.debate_state,
    debate_type: debate.debate_type,
    client_request_id: serverData.client_request_id,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
