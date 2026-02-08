/**
 * Utility functions built on top of the xstate debate machine.
 *
 * These provide a clean API for both CLI and server consumers
 * without requiring them to interact with xstate actors directly.
 */

import { createActor } from 'xstate';

import { debateMachine } from './machine';
import type { ArgumentType, DebateEvent, DebateState, Role } from './types';

/**
 * Check if a transition is valid from current state.
 * Used by: CLI (pre-validate), Server (final validate).
 */
export function canTransition(
  currentState: DebateState,
  event: DebateEvent,
): boolean {
  const snapshot = debateMachine.resolveState({ value: currentState });
  const actor = createActor(debateMachine, { snapshot });
  actor.start();
  const result = actor.getSnapshot().can(event);
  actor.stop();
  return result;
}

/**
 * Calculate next state after transition.
 * Returns null if transition is not allowed.
 * Used by: Server (calculate + persist new state).
 */
export function transition(
  currentState: DebateState,
  event: DebateEvent,
): DebateState | null {
  const snapshot = debateMachine.resolveState({ value: currentState });
  const actor = createActor(debateMachine, { snapshot });
  actor.start();

  if (!actor.getSnapshot().can(event)) {
    actor.stop();
    return null;
  }

  actor.send(event);
  const next = actor.getSnapshot().value as DebateState;
  actor.stop();
  return next;
}

/**
 * Get all valid actions for a given state + role combination.
 * Used by: CLI get-context to tell AI agent what it can do next.
 *
 * Returns event type names (e.g. ['SUBMIT_CLAIM', 'SUBMIT_APPEAL']).
 * SUBMIT_RULING with close=true is reported as 'SUBMIT_RULING_CLOSE'.
 */
export function getAvailableActions(
  currentState: DebateState,
  role: Role,
): string[] {
  if (currentState === 'CLOSED') return [];

  const candidateEvents: DebateEvent[] = [];

  if (role === 'proposer') {
    candidateEvents.push(
      { type: 'SUBMIT_CLAIM', role: 'proposer' },
      { type: 'SUBMIT_APPEAL', role: 'proposer' },
      { type: 'SUBMIT_RESOLUTION', role: 'proposer' },
    );
  } else if (role === 'opponent') {
    candidateEvents.push({ type: 'SUBMIT_CLAIM', role: 'opponent' });
  } else if (role === 'arbitrator') {
    candidateEvents.push(
      { type: 'SUBMIT_INTERVENTION', role: 'arbitrator' },
      { type: 'SUBMIT_RULING', role: 'arbitrator' },
      { type: 'SUBMIT_RULING', role: 'arbitrator', close: true },
    );
  }

  const result: string[] = [];
  for (const event of candidateEvents) {
    if (canTransition(currentState, event)) {
      const label =
        event.type === 'SUBMIT_RULING' && 'close' in event && event.close
          ? 'SUBMIT_RULING_CLOSE'
          : event.type;
      // Avoid duplicates (SUBMIT_RULING and SUBMIT_RULING_CLOSE are separate)
      if (!result.includes(label)) {
        result.push(label);
      }
    }
  }

  return result;
}

/**
 * Map ArgumentType + Role to DebateEvent.
 * Bridge between database model (argument type/role) and xstate events.
 * Used by: Server when processing submissions.
 *
 * Returns null for MOTION (initialization, not a transition) or invalid combinations.
 */
export function toDebateEvent(
  argType: ArgumentType,
  role: Role,
  options?: { close?: boolean },
): DebateEvent | null {
  switch (argType) {
    case 'CLAIM':
      if (role === 'proposer' || role === 'opponent')
        return { type: 'SUBMIT_CLAIM', role };
      return null;
    case 'APPEAL':
      if (role === 'proposer') return { type: 'SUBMIT_APPEAL', role };
      return null;
    case 'RESOLUTION':
      if (role === 'proposer') return { type: 'SUBMIT_RESOLUTION', role };
      return null;
    case 'INTERVENTION':
      if (role === 'arbitrator') return { type: 'SUBMIT_INTERVENTION', role };
      return null;
    case 'RULING':
      if (role === 'arbitrator')
        return { type: 'SUBMIT_RULING', role, close: options?.close };
      return null;
    default:
      return null; // MOTION is initialization, not a transition
  }
}
