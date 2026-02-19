/**
 * Core debate domain types.
 *
 * These are the shared types used by the xstate machine definition,
 * CLI plugin, and NestJS server module.
 */

export type DebateState =
  | 'AWAITING_OPPONENT'
  | 'AWAITING_PROPOSER'
  | 'AWAITING_ARBITRATOR'
  | 'INTERVENTION_PENDING'
  | 'CLOSED';

export type ArgumentType =
  | 'MOTION'
  | 'CLAIM'
  | 'APPEAL'
  | 'RULING'
  | 'INTERVENTION'
  | 'RESOLUTION';

export type Role = 'proposer' | 'opponent' | 'arbitrator';

export type DebateEvent =
  | { type: 'SUBMIT_CLAIM'; role: 'proposer' | 'opponent' }
  | { type: 'SUBMIT_APPEAL'; role: 'proposer' }
  | { type: 'SUBMIT_RESOLUTION'; role: 'proposer' }
  | { type: 'SUBMIT_INTERVENTION'; role: 'arbitrator' }
  | { type: 'SUBMIT_RULING'; role: 'arbitrator'; close?: boolean };
