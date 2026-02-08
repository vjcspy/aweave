import { Injectable } from '@nestjs/common';

type ReleaseFn = () => void;

class Mutex {
  private locked = false;
  private queue: Array<(release: ReleaseFn) => void> = [];

  acquire(): Promise<ReleaseFn> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (!this.locked) {
          this.locked = true;
          resolve(() => this.release());
          return;
        }
        this.queue.push((release) => resolve(release));
      };
      tryAcquire();
    });
  }

  private release(): void {
    if (this.queue.length === 0) {
      this.locked = false;
      return;
    }
    const next = this.queue.shift();
    if (!next) {
      this.locked = false;
      return;
    }
    next(() => this.release());
  }
}

/**
 * Per-debate mutex to serialize write operations.
 *
 * With interval polling (instead of long polling), the EventEmitter/notifier
 * infrastructure is no longer needed. This service only provides mutex locking.
 */
@Injectable()
export class LockService {
  private readonly locks = new Map<string, Mutex>();

  async withLock<T>(debateId: string, fn: () => Promise<T>): Promise<T> {
    const mutex = this.getOrCreateLock(debateId);
    const release = await mutex.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private getOrCreateLock(debateId: string): Mutex {
    const existing = this.locks.get(debateId);
    if (existing) return existing;
    const created = new Mutex();
    this.locks.set(debateId, created);
    return created;
  }
}
