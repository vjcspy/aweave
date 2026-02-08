# Debate Machine (`@aweave/debate-machine`)

> **Source:** `devtools/common/debate-machine/`
> **Last Updated:** 2026-02-07

Shared xstate v5 state machine definition for the debate system. Single source of truth for debate state transitions, consumed by both CLI and server.

## Purpose

This package defines the debate state machine using xstate v5 and provides utility functions for state validation and transition. It eliminates logic duplication between CLI and server — both import the same machine.

| Consumer | How it uses the machine |
|----------|------------------------|
| `@aweave/cli-plugin-debate` | `getAvailableActions()` to enrich `get-context` and `wait` responses with valid actions per role |
| `@aweave/nestjs-debate` | `canTransition()` + `transition()` to validate and compute state transitions before persisting to database |
| `debate-web` (future) | Could import for client-side validation |

## Exports

### Machine

| Export | Description |
|--------|-------------|
| `debateMachine` | xstate v5 machine definition (5 states, 5 event types, 3 guards) |

### Utility Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `canTransition` | `(state, event) → boolean` | Check if event is valid from current state |
| `transition` | `(state, event) → DebateState \| null` | Calculate next state (null if invalid) |
| `getAvailableActions` | `(state, role) → string[]` | List valid event types for state + role |
| `toDebateEvent` | `(argType, role, opts?) → DebateEvent \| null` | Bridge: database model → xstate event |

### Types

| Type | Values |
|------|--------|
| `DebateState` | `AWAITING_OPPONENT`, `AWAITING_PROPOSER`, `AWAITING_ARBITRATOR`, `INTERVENTION_PENDING`, `CLOSED` |
| `ArgumentType` | `MOTION`, `CLAIM`, `APPEAL`, `RULING`, `INTERVENTION`, `RESOLUTION` |
| `Role` | `proposer`, `opponent`, `arbitrator` |
| `DebateEvent` | Union of `SUBMIT_CLAIM`, `SUBMIT_APPEAL`, `SUBMIT_RESOLUTION`, `SUBMIT_INTERVENTION`, `SUBMIT_RULING` |

## State Machine

```
AWAITING_OPPONENT ──CLAIM(opponent)──► AWAITING_PROPOSER
       │                                     │
       │ INTERVENTION                        │ CLAIM(proposer) ──► AWAITING_OPPONENT
       ▼                                     │ APPEAL ──► AWAITING_ARBITRATOR
INTERVENTION_PENDING◄── INTERVENTION ────────│ RESOLUTION ──► AWAITING_ARBITRATOR
       │                                     │ INTERVENTION ──► INTERVENTION_PENDING
       │ RULING ──► AWAITING_PROPOSER        │
       │ RULING(close) ──► CLOSED            │
                                             │
AWAITING_ARBITRATOR ◄────────────────────────┘
       │
       │ RULING ──► AWAITING_PROPOSER
       │ RULING(close) ──► CLOSED
```

## Dependencies

| Package | Role |
|---------|------|
| `xstate` | v5 — state machine engine |

## Project Structure

```
devtools/common/debate-machine/
├── package.json              # @aweave/debate-machine
├── tsconfig.json             # CommonJS (oclif + NestJS compatible)
└── src/
    ├── index.ts              # Barrel export
    ├── types.ts              # DebateState, ArgumentType, Role, DebateEvent
    ├── machine.ts            # xstate machine definition
    └── utils.ts              # canTransition, transition, getAvailableActions, toDebateEvent
```

## Related

- **Debate Spec:** `devdocs/misc/devtools/plans/debate.md` (section 2.1 — states & transitions)
- **CLI Plugin:** `devtools/common/cli-plugin-debate/`
- **NestJS Module:** `devtools/common/nestjs-debate/`
- **Migration Plan:** `devdocs/misc/devtools/plans/260207-xstate-debate-machine.md`
