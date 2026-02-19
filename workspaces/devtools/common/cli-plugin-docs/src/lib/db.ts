/**
 * SQLite database operations for document store.
 *
 * Port of Python docs/db.py using better-sqlite3.
 * Database location: ~/.aweave/docstore.db (override via AWEAVE_DB_PATH)
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SCHEMA_VERSION = '1';

function getDbPath(): string {
  const envPath = process.env.AWEAVE_DB_PATH;
  if (envPath) return envPath;

  const dbDir = join(homedir(), '.aweave');
  mkdirSync(dbDir, { recursive: true });
  return join(dbDir, 'docstore.db');
}

function initDb(): Database.Database {
  const dbPath = getDbPath();
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      deleted_at TEXT DEFAULT NULL,
      UNIQUE(document_id, version)
    );

    CREATE INDEX IF NOT EXISTS idx_doc_id ON document_versions(document_id);
    CREATE INDEX IF NOT EXISTS idx_doc_latest ON document_versions(document_id, version DESC);
    CREATE INDEX IF NOT EXISTS idx_created_at ON document_versions(created_at DESC);
  `);

  // Partial index for active documents
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_active
    ON document_versions(document_id) WHERE deleted_at IS NULL
  `);

  const insertMeta = db.prepare(
    'INSERT OR IGNORE INTO schema_meta (key, value) VALUES (?, ?)',
  );
  insertMeta.run('version', SCHEMA_VERSION);

  return db;
}

export interface DocResult {
  document_id: string;
  version: number;
  id: string;
}

export interface DocRecord {
  id: string;
  document_id: string;
  summary: string;
  content: string;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DocListItem {
  document_id: string;
  summary: string;
  version: number;
  created_at: string;
}

export interface VersionItem {
  version: number;
  summary: string;
  created_at: string;
}

export function createDocument(
  summary: string,
  content: string,
  metadata: Record<string, unknown>,
): DocResult {
  const db = initDb();
  try {
    const documentId = randomUUID();
    const versionId = randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO document_versions
       (id, document_id, summary, content, version, metadata, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      versionId,
      documentId,
      summary,
      content,
      JSON.stringify(metadata),
      createdAt,
    );

    return { document_id: documentId, version: 1, id: versionId };
  } finally {
    db.close();
  }
}

export function submitVersion(
  documentId: string,
  summary: string,
  content: string,
  metadata: Record<string, unknown>,
): DocResult | null {
  const db = initDb();
  try {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = db.transaction(() => {
          // Check document exists and not deleted
          const exists = db
            .prepare(
              'SELECT 1 FROM document_versions WHERE document_id = ? AND deleted_at IS NULL LIMIT 1',
            )
            .get(documentId);

          if (!exists) return null;

          // Get next version
          const row = db
            .prepare(
              'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM document_versions WHERE document_id = ?',
            )
            .get(documentId) as { next_version: number };

          const nextVersion = row.next_version;
          const versionId = randomUUID();
          const createdAt = new Date().toISOString();

          db.prepare(
            `INSERT INTO document_versions
             (id, document_id, summary, content, version, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            versionId,
            documentId,
            summary,
            content,
            nextVersion,
            JSON.stringify(metadata),
            createdAt,
          );

          return {
            document_id: documentId,
            version: nextVersion,
            id: versionId,
          };
        })();

        return result;
      } catch (err) {
        // Retry on SQLITE_CONSTRAINT (version conflict)
        if (
          err instanceof Error &&
          err.message.includes('UNIQUE constraint') &&
          attempt < maxRetries - 1
        ) {
          continue;
        }
        throw err;
      }
    }

    return null;
  } finally {
    db.close();
  }
}

export function getDocument(
  documentId: string,
  version?: number,
): DocRecord | null {
  const db = initDb();
  try {
    let row: Record<string, unknown> | undefined;

    if (version !== undefined) {
      row = db
        .prepare(
          `SELECT * FROM document_versions
           WHERE document_id = ? AND version = ? AND deleted_at IS NULL`,
        )
        .get(documentId, version) as Record<string, unknown> | undefined;
    } else {
      row = db
        .prepare(
          `SELECT * FROM document_versions
           WHERE document_id = ? AND deleted_at IS NULL
           ORDER BY version DESC LIMIT 1`,
        )
        .get(documentId) as Record<string, unknown> | undefined;
    }

    if (!row) return null;

    return {
      id: row.id as string,
      document_id: row.document_id as string,
      summary: row.summary as string,
      content: row.content as string,
      version: row.version as number,
      metadata: JSON.parse((row.metadata as string) ?? '{}'),
      created_at: row.created_at as string,
    };
  } finally {
    db.close();
  }
}

export function listDocuments(
  limit?: number,
  includeDeleted = false,
): [DocListItem[], number] {
  const db = initDb();
  try {
    const deletedFilter = includeDeleted ? '' : 'WHERE deleted_at IS NULL';
    const innerFilter = includeDeleted ? '' : 'WHERE deleted_at IS NULL';

    let query = `
      SELECT dv.* FROM document_versions dv
      INNER JOIN (
        SELECT document_id, MAX(version) as max_version
        FROM document_versions ${innerFilter}
        GROUP BY document_id
      ) latest ON dv.document_id = latest.document_id AND dv.version = latest.max_version
      ${deletedFilter}
      ORDER BY dv.created_at DESC
    `;

    if (limit !== undefined) query += ` LIMIT ${limit}`;

    const rows = db.prepare(query).all() as Array<Record<string, unknown>>;

    const countRow = db
      .prepare(
        `SELECT COUNT(DISTINCT document_id) as cnt FROM document_versions ${deletedFilter}`,
      )
      .get() as { cnt: number };

    const documents: DocListItem[] = rows.map((r) => ({
      document_id: r.document_id as string,
      summary: r.summary as string,
      version: r.version as number,
      created_at: r.created_at as string,
    }));

    return [documents, countRow.cnt];
  } finally {
    db.close();
  }
}

export function getHistory(
  documentId: string,
  limit?: number,
): [VersionItem[], number] {
  const db = initDb();
  try {
    let query = `SELECT id, version, summary, created_at FROM document_versions
                 WHERE document_id = ? AND deleted_at IS NULL
                 ORDER BY version DESC`;

    if (limit !== undefined) query += ` LIMIT ${limit}`;

    const rows = db.prepare(query).all(documentId) as Array<
      Record<string, unknown>
    >;

    const countRow = db
      .prepare(
        'SELECT COUNT(*) as cnt FROM document_versions WHERE document_id = ? AND deleted_at IS NULL',
      )
      .get(documentId) as { cnt: number };

    const versions: VersionItem[] = rows.map((r) => ({
      version: r.version as number,
      summary: r.summary as string,
      created_at: r.created_at as string,
    }));

    return [versions, countRow.cnt];
  } finally {
    db.close();
  }
}

export function softDeleteDocument(documentId: string): number {
  const db = initDb();
  try {
    const deletedAt = new Date().toISOString();
    const result = db
      .prepare(
        'UPDATE document_versions SET deleted_at = ? WHERE document_id = ? AND deleted_at IS NULL',
      )
      .run(deletedAt, documentId);

    return result.changes;
  } finally {
    db.close();
  }
}
