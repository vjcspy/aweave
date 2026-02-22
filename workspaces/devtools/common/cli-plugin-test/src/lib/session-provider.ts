import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { BrowserContext } from '@hod/aweave-playwright';

const DEFAULT_AWEAVE_DIR = '.aweave';
const DEFAULT_CURSOR_USERDATA_DIR = 'userdata';
const DEFAULT_CURSOR_STATE_FILE = 'cursor-session.json';
const CURSOR_STATE_PATH_ENV = 'AWEAVE_CURSOR_STATE_PATH';

export type CursorSessionState = Awaited<
  ReturnType<BrowserContext['storageState']>
>;

export interface SessionProvider<TSession = CursorSessionState> {
  load(): Promise<TSession | null>;
  save(session: TSession): Promise<void>;
  getPath(): string;
}

export class JsonSessionProvider implements SessionProvider {
  private readonly filePath: string;

  constructor(filePath = JsonSessionProvider.resolveDefaultPath()) {
    this.filePath = filePath;
  }

  static resolveDefaultPath(): string {
    const envPath = process.env[CURSOR_STATE_PATH_ENV];
    if (envPath && envPath.trim()) {
      return envPath.trim();
    }

    return path.join(
      os.homedir(),
      DEFAULT_AWEAVE_DIR,
      DEFAULT_CURSOR_USERDATA_DIR,
      DEFAULT_CURSOR_STATE_FILE,
    );
  }

  getPath(): string {
    return this.filePath;
  }

  async load(): Promise<CursorSessionState | null> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(raw) as CursorSessionState;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return null;
      }

      if (error instanceof SyntaxError) {
        throw new Error(
          `Invalid Cursor session JSON at "${this.filePath}". Delete it and re-run "aw test cursor save".`,
        );
      }

      throw error;
    }
  }

  async save(session: CursorSessionState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(
      this.filePath,
      `${JSON.stringify(session, null, 2)}\n`,
      'utf-8',
    );
  }
}
