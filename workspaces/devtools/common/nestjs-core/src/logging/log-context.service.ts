import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncLocalStorage-backed request context store.
 * Used to propagate correlationId and other per-request metadata
 * through the async call chain without passing it explicitly.
 */
@Injectable()
export class LogContextService {
  private readonly store = new AsyncLocalStorage<Map<string, unknown>>();

  /**
   * Execute `fn` within a new context scope containing the given entries.
   * All code within `fn` (including async continuations) will see the context.
   */
  run<T>(context: Record<string, unknown>, fn: () => T): T {
    const map = new Map(Object.entries(context));
    return this.store.run(map, fn);
  }

  /** Get a single context value by key. */
  get<T = unknown>(key: string): T | undefined {
    return this.store.getStore()?.get(key) as T | undefined;
  }

  /** Set a single context value. No-op if called outside a context scope. */
  set(key: string, value: unknown): void {
    this.store.getStore()?.set(key, value);
  }

  /** Get all context entries as a plain object. Returns empty object outside scope. */
  getAll(): Record<string, unknown> {
    const map = this.store.getStore();
    if (!map) return {};
    return Object.fromEntries(map);
  }
}
