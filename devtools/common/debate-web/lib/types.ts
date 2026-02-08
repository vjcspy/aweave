import type { Debate, Argument } from './api';

// Re-export for convenience — components use these as union types
export type { Debate, Argument };
export type DebateState = Debate['state'];
export type ArgumentType = Argument['type'];
export type Role = Argument['role'];

/**
 * Generic WebSocket event envelope.
 */
export type WsEvent<E extends string = string, D = unknown> = {
  event: E;
  data: D;
};

// ── Server → Client ──

export type ServerToClientMessage =
  | WsEvent<'initial_state', { debate: Debate; arguments: Argument[] }>
  | WsEvent<'new_argument', { debate: Debate; argument: Argument }>;

// ── Client → Server ──

export type ClientToServerMessage =
  | WsEvent<'submit_intervention', { debate_id: string; content?: string }>
  | WsEvent<'submit_ruling', { debate_id: string; content: string; close?: boolean }>;
