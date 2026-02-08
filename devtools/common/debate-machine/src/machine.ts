/**
 * Debate state machine definition using xstate v5.
 *
 * This is the single source of truth for debate state transitions.
 * Imported by both CLI (pre-validation, available actions) and server (final validation).
 *
 * States and transitions match the spec at devdocs/misc/devtools/debate.md section 2.1.
 */

import { setup } from 'xstate';

import type { DebateEvent } from './types';

export const debateMachine = setup({
  types: {
    events: {} as DebateEvent,
  },
  guards: {
    isOpponent: ({ event }) => 'role' in event && event.role === 'opponent',
    isProposer: ({ event }) => 'role' in event && event.role === 'proposer',
    isCloseRuling: ({ event }) =>
      event.type === 'SUBMIT_RULING' && event.close === true,
  },
}).createMachine({
  id: 'debate',
  initial: 'AWAITING_OPPONENT',
  states: {
    AWAITING_OPPONENT: {
      on: {
        SUBMIT_CLAIM: { target: 'AWAITING_PROPOSER', guard: 'isOpponent' },
        SUBMIT_INTERVENTION: 'INTERVENTION_PENDING',
      },
    },
    AWAITING_PROPOSER: {
      on: {
        SUBMIT_CLAIM: { target: 'AWAITING_OPPONENT', guard: 'isProposer' },
        SUBMIT_APPEAL: 'AWAITING_ARBITRATOR',
        SUBMIT_INTERVENTION: 'INTERVENTION_PENDING',
        SUBMIT_RESOLUTION: 'AWAITING_ARBITRATOR',
      },
    },
    AWAITING_ARBITRATOR: {
      on: {
        SUBMIT_RULING: [
          { target: 'CLOSED', guard: 'isCloseRuling' },
          { target: 'AWAITING_PROPOSER' },
        ],
      },
    },
    INTERVENTION_PENDING: {
      on: {
        SUBMIT_RULING: [
          { target: 'CLOSED', guard: 'isCloseRuling' },
          { target: 'AWAITING_PROPOSER' },
        ],
      },
    },
    CLOSED: { type: 'final' },
  },
});
