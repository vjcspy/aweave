import type { ArgumentDto, DebateDto } from './dto';

/**
 * Generic WebSocket event envelope.
 * All WS messages follow this shape — only `event` name and `data` differ.
 */
export type WsEvent<E extends string = string, D = unknown> = {
  event: E;
  data: D;
};

// ── Server → Client ──

export type InitialStateEvent = WsEvent<
  'initial_state',
  {
    debate: DebateDto;
    arguments: ArgumentDto[];
  }
>;

export type NewArgumentEvent = WsEvent<
  'new_argument',
  {
    debate: DebateDto;
    argument: ArgumentDto;
  }
>;

export type ServerToClientEvent = InitialStateEvent | NewArgumentEvent;

// ── Client → Server ──

export type SubmitInterventionEvent = WsEvent<
  'submit_intervention',
  {
    debate_id: string;
    content?: string;
  }
>;

export type SubmitRulingEvent = WsEvent<
  'submit_ruling',
  {
    debate_id: string;
    content: string;
    close?: boolean;
  }
>;

export type ClientToServerEvent = SubmitInterventionEvent | SubmitRulingEvent;
