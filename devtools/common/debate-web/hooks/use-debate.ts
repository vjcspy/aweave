'use client';

import { useEffect, useRef, useReducer, useCallback } from 'react';
import type { Debate, Argument } from '@/lib/api';
import type { ServerToClientMessage, ClientToServerMessage } from '@/lib/types';
import { getWsUrl } from '@/lib/api';

type DebateState = {
  debate: Debate | null;
  arguments: Argument[];
  connected: boolean;
  error: string | null;
};

type DebateAction =
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR'; error: string }
  | { type: 'INITIAL_STATE'; debate: Debate; arguments: Argument[] }
  | { type: 'NEW_ARGUMENT'; debate: Debate; argument: Argument };

function debateReducer(state: DebateState, action: DebateAction): DebateState {
  switch (action.type) {
    case 'CONNECTED':
      return { ...state, connected: true, error: null };
    case 'DISCONNECTED':
      return { ...state, connected: false };
    case 'ERROR':
      return { ...state, error: action.error };
    case 'INITIAL_STATE':
      return {
        ...state,
        debate: action.debate,
        arguments: action.arguments,
      };
    case 'NEW_ARGUMENT':
      return {
        ...state,
        debate: action.debate,
        arguments: [...state.arguments, action.argument],
      };
    default:
      return state;
  }
}

const initialState: DebateState = {
  debate: null,
  arguments: [],
  connected: false,
  error: null,
};

export function useDebate(debateId: string) {
  const [state, dispatch] = useReducer(debateReducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${getWsUrl()}/ws?debate_id=${debateId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      reconnectAttempts.current = 0;
      dispatch({ type: 'CONNECTED' });
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerToClientMessage = JSON.parse(event.data);
        
        if (msg.event === 'initial_state') {
          dispatch({
            type: 'INITIAL_STATE',
            debate: msg.data.debate,
            arguments: msg.data.arguments,
          });
        } else if (msg.event === 'new_argument') {
          dispatch({
            type: 'NEW_ARGUMENT',
            debate: msg.data.debate,
            argument: msg.data.argument,
          });
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      dispatch({ type: 'DISCONNECTED' });
      
      // Exponential backoff reconnection
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current++;
      
      reconnectTimeoutRef.current = setTimeout(() => connectRef.current?.(), delay);
    };

    ws.onerror = () => {
      dispatch({ type: 'ERROR', error: 'WebSocket connection failed' });
    };

    wsRef.current = ws;
  }, [debateId]);

  // Keep ref in sync so reconnect always uses latest connect
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((message: ClientToServerMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const submitIntervention = useCallback((content?: string) => {
    send({
      event: 'submit_intervention',
      data: { debate_id: debateId, content },
    });
  }, [debateId, send]);

  const submitRuling = useCallback((content: string, close?: boolean) => {
    send({
      event: 'submit_ruling',
      data: { debate_id: debateId, content, close },
    });
  }, [debateId, send]);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    ...state,
    submitIntervention,
    submitRuling,
    reconnect: connect,
  };
}
