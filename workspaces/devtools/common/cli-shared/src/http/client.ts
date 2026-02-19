/**
 * Base HTTP client with error handling.
 *
 * Uses Node.js native fetch (available in Node 18+, stable in Node 21+).
 * Port of Python aweave/http/client.py.
 */

export class HTTPClientError extends Error {
  code: string;
  suggestion?: string;

  constructor(code: string, message: string, suggestion?: string) {
    super(message);
    this.name = 'HTTPClientError';
    this.code = code;
    this.suggestion = suggestion;
  }
}

export interface HTTPClientOptions {
  baseUrl: string;
  auth?: { username: string; password: string };
  headers?: Record<string, string>;
  /** Timeout in milliseconds. Default: 30000 (30s) */
  timeout?: number;
}

export class HTTPClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(options: HTTPClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.headers = { 'Content-Type': 'application/json', ...options.headers };
    this.timeout = options.timeout ?? 30_000;

    if (options.auth) {
      const encoded = Buffer.from(
        `${options.auth.username}:${options.auth.password}`,
      ).toString('base64');
      this.headers['Authorization'] = `Basic ${encoded}`;
    }
  }

  /**
   * GET request, returns parsed JSON.
   */
  async get(
    path: string,
    params?: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const url = this.buildUrl(path, params);
    return this.request(url, { method: 'GET' });
  }

  /**
   * POST request, returns parsed JSON.
   */
  async post(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = this.buildUrl(path);
    return this.request(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request, returns parsed JSON.
   */
  async put(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = this.buildUrl(path);
    return this.request(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request, returns parsed JSON.
   */
  async delete(path: string): Promise<Record<string, unknown>> {
    const url = this.buildUrl(path);
    return this.request(url, { method: 'DELETE' });
  }

  /**
   * GET request using full absolute URL (for pagination next links).
   * Bypasses baseUrl.
   */
  async getUrl(absoluteUrl: string): Promise<Record<string, unknown>> {
    return this.request(absoluteUrl, { method: 'GET' });
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    // If path is already absolute URL, use as-is.
    // Otherwise concatenate baseUrl + path (new URL(path, base) drops base path when path starts with '/').
    const url = path.startsWith('http')
      ? new URL(path)
      : new URL(this.baseUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }
    return url.toString();
  }

  private async request(
    url: string,
    init: RequestInit,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        headers: this.headers,
        signal: controller.signal,
      });

      if (response.status === 401) {
        throw new HTTPClientError(
          'AUTH_FAILED',
          'Authentication failed',
          'Check your credentials (username/password or token)',
        );
      }

      if (response.status === 403) {
        throw new HTTPClientError(
          'FORBIDDEN',
          'Access denied',
          'Check if you have the required permissions',
        );
      }

      if (response.status === 404) {
        throw new HTTPClientError(
          'NOT_FOUND',
          'Resource not found',
          'Verify the resource ID/path is correct',
        );
      }

      if (response.status >= 400) {
        throw new HTTPClientError(
          `HTTP_${response.status}`,
          `Request failed: ${await response.text()}`,
        );
      }

      if (response.status === 204) {
        return {};
      }

      return (await response.json()) as Record<string, unknown>;
    } catch (err) {
      if (err instanceof HTTPClientError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new HTTPClientError(
          'TIMEOUT',
          `Request timed out after ${this.timeout}ms`,
        );
      }
      throw new HTTPClientError(
        'NETWORK_ERROR',
        `Network error: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
