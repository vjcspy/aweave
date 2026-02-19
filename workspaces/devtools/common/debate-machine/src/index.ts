export { debateMachine } from './machine';
export type { ArgumentType, DebateEvent, DebateState, Role } from './types';
export {
  canTransition,
  getAvailableActions,
  toDebateEvent,
  transition,
} from './utils';
