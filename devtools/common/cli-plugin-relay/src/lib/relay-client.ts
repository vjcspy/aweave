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
  data: string; // base64
}

interface CompletePayload {
  sessionId: string;
  repo: string;
  branch: string;
  baseBranch: string;
  iv: string; // base64
  authTag: string; // base64
}

interface StatusResponse {
  sessionId: string;
  status: 'receiving' | 'processing' | 'pushed' | 'failed';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Upload a single chunk to the relay. Retries on network failure.
 */
export async function uploadChunk(
  relayUrl: string,
  apiKey: string,
  payload: ChunkUploadPayload,
): Promise<{ success: boolean; received: number }> {
  return fetchWithRetry(`${relayUrl}/api/relay/chunk`, apiKey, payload);
}

/**
 * Signal that all chunks are uploaded. Triggers server-side processing.
 */
export async function signalComplete(
  relayUrl: string,
  apiKey: string,
  payload: CompletePayload,
): Promise<void> {
  await fetchWithRetry(`${relayUrl}/api/relay/complete`, apiKey, payload);
}

/**
 * Poll session status until terminal state (pushed/failed) or timeout.
 */
export async function pollStatus(
  relayUrl: string,
  apiKey: string,
  sessionId: string,
): Promise<StatusResponse> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_DURATION_MS) {
    const response = await fetchJson(`${relayUrl}/api/relay/status/${sessionId}`, {
      method: 'GET',
      headers: {
        'X-Relay-Key': apiKey,
      },
    });

    const status = response as StatusResponse;

    if (status.status === 'pushed' || status.status === 'failed') {
      return status;
    }

    // Wait before next poll
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Status polling timed out after ${MAX_POLL_DURATION_MS / 1000}s for session ${sessionId}`);
}

/**
 * POST JSON with exponential backoff retry on network errors.
 */
async function fetchWithRetry<T>(url: string, apiKey: string, body: unknown): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fetchJson(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Key': apiKey,
        },
        body: JSON.stringify(body),
      }) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on auth errors or client errors
      if (lastError.message.includes('401') || lastError.message.includes('400')) {
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
