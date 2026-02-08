export { ArgumentService } from './argument.service';
export { DebateGateway } from './debate.gateway';
export { DebateModule } from './debate.module';
export { DebateService } from './debate.service';

// All DTOs (entity, request, response, error) — consumed by @aweave/server for Swagger setup
export * from './dto';

// WS event types — consumed by debate-web for WebSocket typing
export type {
  ClientToServerEvent,
  InitialStateEvent,
  NewArgumentEvent,
  ServerToClientEvent,
  SubmitInterventionEvent,
  SubmitRulingEvent,
  WsEvent,
} from './ws-types';
