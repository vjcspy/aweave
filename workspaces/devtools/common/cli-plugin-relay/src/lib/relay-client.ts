import { randomBytes } from 'node:crypto';

import type { RelayConfig } from './config';
import { encryptPayload } from './crypto';

/** Max retry attempts for failed requests */
const MAX_RETRIES = 3;

/** Initial backoff delay in ms */
const INITIAL_BACKOFF_MS = 1000;

/** Status poll interval in ms */
const POLL_INTERVAL_MS = 2000;

/** Max status poll duration in ms (5 minutes) */
const MAX_POLL_DURATION_MS = 5 * 60 * 1000;

interface ChunkUploadPayload {
  sessionId: string;
  chunkIndex: number;
  totalChunks: number;
}

interface CompletePayload {
  sessionId: string;
}

interface GRPayload {
  sessionId: string;
  repo: string;
  branch: string;
  baseBranch: string;
}

interface FileStorePayload {
  sessionId: string;
  fileName: string;
  size: number;
  sha256: string;
}

interface StatusResponse {
  sessionId: string;
  status:
    | 'receiving'
    | 'complete'
    | 'processing'
    | 'pushed'
    | 'stored'
    | 'failed';
  message: string;
  details?: Record<string, unknown>;
}

interface PollOptions {
  successStates?: string[];
  failureStates?: string[];
}

/**
 * Upload a single chunk to the relay. Retries on network failure.
 */
export async function uploadChunk(
  relayUrl: string,
  apiKey: string,
  transportConfig: RelayConfig,
  payload: ChunkUploadPayload,
  chunkData: Buffer,
): Promise<{ success: boolean; received: number }> {
  return fetchWithRetry(
    `${relayUrl}/api/game/chunk`,
    apiKey,
    transportConfig,
    payload,
    chunkData,
  );
}

/**
 * Signal that all chunks are uploaded.
 */
export async function signalComplete(
  relayUrl: string,
  apiKey: string,
  transportConfig: RelayConfig,
  payload: CompletePayload,
): Promise<void> {
  await fetchWithRetry(
    `${relayUrl}/api/game/chunk/complete`,
    apiKey,
    transportConfig,
    payload,
  );
}

/**
 * Trigger Git Relay processing for a completed session.
 */
export async function triggerGR(
  relayUrl: string,
  apiKey: string,
  transportConfig: RelayConfig,
  payload: GRPayload,
): Promise<void> {
  await fetchWithRetry(
    `${relayUrl}/api/game/gr`,
    apiKey,
    transportConfig,
    payload,
  );
}

/**
 * Trigger file store/finalize for a completed upload session.
 */
export async function triggerFileStore(
  relayUrl: string,
  apiKey: string,
  transportConfig: RelayConfig,
  payload: FileStorePayload,
): Promise<void> {
  await fetchWithRetry(
    `${relayUrl}/api/game/file/store`,
    apiKey,
    transportConfig,
    payload,
  );
}

/**
 * Get the latest commit SHA for a remote branch.
 */
export async function getRemoteInfo(
  relayUrl: string,
  apiKey: string,
  repo: string,
  branch: string,
): Promise<string> {
  const url = new URL(`${relayUrl}/api/game/remote-info`);
  url.searchParams.append('repo', repo);
  url.searchParams.append('branch', branch);

  const response = await fetchJson(url.toString(), {
    method: 'GET',
    headers: {
      'X-Relay-Key': apiKey,
    },
  });

  return (response as { sha: string }).sha;
}

/**
 * Poll session status until terminal state or timeout.
 * Configurable terminal states allow both Git (pushed/failed) and file (stored/failed) flows.
 */
export async function pollStatus(
  relayUrl: string,
  apiKey: string,
  sessionId: string,
  options?: PollOptions,
): Promise<StatusResponse> {
  const successStates = options?.successStates ?? ['pushed'];
  const failureStates = options?.failureStates ?? ['failed'];
  const terminalStates = new Set([...successStates, ...failureStates]);
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_DURATION_MS) {
    const response = await fetchJson(
      `${relayUrl}/api/game/chunk/status/${sessionId}`,
      {
        method: 'GET',
        headers: {
          'X-Relay-Key': apiKey,
        },
      },
    );

    const status = response as StatusResponse;

    if (terminalStates.has(status.status)) {
      return status;
    }

    // Wait before next poll
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `Status polling timed out after ${MAX_POLL_DURATION_MS / 1000}s for session ${sessionId}`,
  );
}

/**
 * POST JSON with exponential backoff retry on network errors.
 */
async function fetchWithRetry<T>(
  url: string,
  apiKey: string,
  transportConfig: RelayConfig,
  metadata: object,
  binaryData?: Buffer,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const transportMetadata = {
        ...metadata,
        timestamp: Date.now(),
        nonce: randomBytes(16).toString('hex'),
      };
      const gameData = encryptPayload(
        transportMetadata,
        transportConfig,
        binaryData,
      );
      return (await fetchJson(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Key': apiKey,
        },
        body: JSON.stringify({ gameData }),
      })) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on auth errors or client errors
      if (
        lastError.message.includes('401') ||
        lastError.message.includes('400')
      ) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES - 1) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await sleep(backoff);
      }
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}

/** Fetch JSON with error handling */
async function fetchJson(url: string, options: RequestInit): Promise<unknown> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let errorMessage: string;

    try {
      const errorJson = JSON.parse(text);
      errorMessage = errorJson.message || errorJson.error || text;
    } catch {
      errorMessage = text || `HTTP ${response.status}`;
    }

    throw new Error(`${response.status}: ${errorMessage}`);
  }

  return response.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
