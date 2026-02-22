import createClient from 'openapi-fetch';

import type { components, paths } from './api-types';
import { config } from './config';

// Re-export entity types from generated spec for convenience
export type Debate = components['schemas']['DebateDto'];
export type Argument = components['schemas']['ArgumentDto'];

// Typed API client — all paths, params, responses auto-inferred
export const api = createClient<paths>({ baseUrl: config.apiBaseUrl });

export function getServerUrl(): string {
  return config.apiBaseUrl;
}

export function getWsUrl(): string {
  return config.wsBaseUrl;
}

// ── Thin wrapper functions (migration-safe, typed via openapi-fetch) ──

export async function fetchDebates(offset?: number) {
  const { data, error } = await api.GET('/debates', {
    params: { query: { offset } },
  });
  if (error || !data) throw new Error('Failed to fetch debates');
  return data.data;
}

export async function fetchDebate(id: string, limit?: number) {
  const { data, error } = await api.GET('/debates/{id}', {
    params: { path: { id }, query: { limit } },
  });
  if (error || !data) throw new Error('Failed to fetch debate');
  return data.data;
}

export async function deleteDebate(id: string) {
  const { data, error } = await api.DELETE('/debates/{id}', {
    params: { path: { id } },
  });
  if (error || !data) throw new Error('Failed to delete debate');
  return data;
}
