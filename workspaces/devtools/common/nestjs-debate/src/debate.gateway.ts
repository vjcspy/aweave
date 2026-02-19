import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { IncomingMessage } from 'http';
import type { Server } from 'ws';
import type WebSocket from 'ws';

type ServerToClientMessage =
  | {
      event: 'initial_state';
      data: {
        debate: Record<string, unknown>;
        arguments: Record<string, unknown>[];
      };
    }
  | {
      event: 'new_argument';
      data: {
        debate: Record<string, unknown>;
        argument: Record<string, unknown>;
      };
    };

/**
 * WebSocket gateway for real-time debate updates.
 *
 * Clients connect with: ws://host:port/ws?debate_id=<uuid>[&token=<auth_token>]
 *
 * Server → Client events: initial_state, new_argument
 * Client → Server events: submit_intervention, submit_ruling
 */
@WebSocketGateway({ path: '/ws' })
export class DebateGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(DebateGateway.name);

  // Track which clients are subscribed to which debate
  private readonly clientsByDebateId = new Map<string, Set<WebSocket>>();
  private readonly debateIdByClient = new Map<WebSocket, string>();

  // These will be injected after module init via setServices()
  private getInitialState?: (debateId: string) => Promise<{
    debate: Record<string, unknown>;
    arguments: Record<string, unknown>[];
  }>;
  private onSubmitIntervention?: (input: {
    debate_id: string;
    content?: string;
  }) => Promise<void>;
  private onSubmitRuling?: (input: {
    debate_id: string;
    content: string;
    close?: boolean;
  }) => Promise<void>;

  /**
   * Called by DebateModule.onModuleInit to inject service callbacks.
   * This avoids circular dependency between Gateway and Services.
   */
  setHandlers(handlers: {
    getInitialState: (debateId: string) => Promise<{
      debate: Record<string, unknown>;
      arguments: Record<string, unknown>[];
    }>;
    onSubmitIntervention: (input: {
      debate_id: string;
      content?: string;
    }) => Promise<void>;
    onSubmitRuling: (input: {
      debate_id: string;
      content: string;
      close?: boolean;
    }) => Promise<void>;
  }) {
    this.getInitialState = handlers.getInitialState;
    this.onSubmitIntervention = handlers.onSubmitIntervention;
    this.onSubmitRuling = handlers.onSubmitRuling;
  }

  async handleConnection(client: WebSocket, ...args: unknown[]) {
    const req = args[0] as IncomingMessage | undefined;
    const url = new URL(
      req?.url || '/',
      `http://${req?.headers?.host || 'localhost'}`,
    );
    const debateId = url.searchParams.get('debate_id');

    // Auth check
    const authToken = process.env.AUTH_TOKEN;
    if (authToken) {
      const token = url.searchParams.get('token');
      if (!token || token !== authToken) {
        this.logger.warn('WebSocket connection rejected: invalid token');
        client.close();
        return;
      }
    }

    if (!debateId) {
      this.logger.warn('WebSocket connection rejected: no debate_id');
      client.close();
      return;
    }

    // Subscribe to debate room
    this.subscribe(debateId, client);

    // Send initial state
    if (this.getInitialState) {
      try {
        const initial = await this.getInitialState(debateId);
        this.send(client, { event: 'initial_state', data: initial });
      } catch {
        this.logger.warn(`Failed to get initial state for debate ${debateId}`);
        client.close();
        return;
      }
    }

    this.logger.debug(`Client connected to debate ${debateId}`);
  }

  handleDisconnect(client: WebSocket) {
    const debateId = this.debateIdByClient.get(client);
    if (debateId) {
      this.unsubscribe(debateId, client);
      this.logger.debug(`Client disconnected from debate ${debateId}`);
    }
  }

  @SubscribeMessage('submit_intervention')
  async handleIntervention(
    client: WebSocket,
    data: { debate_id: string; content?: string },
  ) {
    if (this.onSubmitIntervention) {
      try {
        await this.onSubmitIntervention(data);
      } catch (err) {
        this.logger.error(`Intervention failed: ${err}`);
      }
    }
  }

  @SubscribeMessage('submit_ruling')
  async handleRuling(
    client: WebSocket,
    data: { debate_id: string; content: string; close?: boolean },
  ) {
    if (this.onSubmitRuling) {
      try {
        await this.onSubmitRuling(data);
      } catch (err) {
        this.logger.error(`Ruling failed: ${err}`);
      }
    }
  }

  /**
   * Broadcast a new argument to all WebSocket clients subscribed to the debate.
   * Called by DebateService / ArgumentService after successful write.
   */
  broadcastNewArgument(
    debateId: string,
    debate: Record<string, unknown>,
    argument: Record<string, unknown>,
  ) {
    const clients = this.clientsByDebateId.get(debateId);
    if (!clients || clients.size === 0) return;

    const payload: ServerToClientMessage = {
      event: 'new_argument',
      data: { debate, argument },
    };

    for (const ws of clients) {
      // ws library readyState: 1 = OPEN
      if ((ws as any).readyState !== 1) continue;
      this.send(ws, payload);
    }
  }

  private subscribe(debateId: string, ws: WebSocket) {
    const existing = this.clientsByDebateId.get(debateId);
    if (existing) {
      existing.add(ws);
    } else {
      this.clientsByDebateId.set(debateId, new Set([ws]));
    }
    this.debateIdByClient.set(ws, debateId);
  }

  private unsubscribe(debateId: string, ws: WebSocket) {
    const set = this.clientsByDebateId.get(debateId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) this.clientsByDebateId.delete(debateId);
    }
    this.debateIdByClient.delete(ws);
  }

  private send(ws: WebSocket, message: ServerToClientMessage) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Ignore send errors (client may have disconnected)
    }
  }
}
