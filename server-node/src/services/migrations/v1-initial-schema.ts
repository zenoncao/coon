/**
 * V1 初始 Schema 迁移
 * 创建 chat_sessions 和 chat_messages 表
 */

import Database from 'better-sqlite3';
import { Migration } from './index';

export class V1InitialSchema implements Migration {
  version = 1;
  description = '初始 Schema';

  up(conn: Database.Database): void {
    // 创建 chat_sessions 表
    conn.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        canvas_id TEXT,
        created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        title TEXT,
        model TEXT,
        provider TEXT,
        FOREIGN KEY (canvas_id) REFERENCES canvases(id)
      )
    `);

    conn.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC, id DESC)
    `);

    // 创建 chat_messages 表
    conn.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        role TEXT,
        message TEXT,
        created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
      )
    `);

    conn.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id_id ON chat_messages(session_id, id)
    `);
  }

  down(conn: Database.Database): void {
    conn.exec('DROP TABLE IF EXISTS chat_messages');
    conn.exec('DROP TABLE IF EXISTS chat_sessions');
  }
}