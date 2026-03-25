/**
 * V2 添加画布表迁移
 * 创建 canvases 表并关联 chat_sessions
 */

import Database from 'better-sqlite3';
import { Migration } from './index';

export class V2AddCanvases implements Migration {
  version = 2;
  description = '添加画布表';

  up(conn: Database.Database): void {
    // 创建 canvases 表
    conn.exec(`
      CREATE TABLE IF NOT EXISTS canvases (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data TEXT,
        description TEXT DEFAULT '',
        thumbnail TEXT DEFAULT '',
        created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);

    conn.exec(`
      CREATE INDEX IF NOT EXISTS idx_canvases_updated_at ON canvases(updated_at DESC, id DESC)
    `);

    // 检查 canvas_id 列是否已存在
    const columns = conn.pragma('table_info(chat_sessions)') as { name: string }[];
    const hasCanvasId = columns.some((col) => col.name === 'canvas_id');

    if (!hasCanvasId) {
      // 添加 canvas_id 列到 chat_sessions
      conn.exec(`
        ALTER TABLE chat_sessions ADD COLUMN canvas_id TEXT REFERENCES canvases(id)
      `);
    }

    // 创建默认画布
    conn.exec(`
      INSERT OR IGNORE INTO canvases (id, name)
      VALUES ('default', 'Default Canvas')
    `);

    // 将所有现有会话关联到默认画布
    conn.exec(`
      UPDATE chat_sessions
      SET canvas_id = 'default'
      WHERE canvas_id IS NULL
    `);
  }

  down(conn: Database.Database): void {
    // 创建新的 chat_sessions 表（不包含 canvas_id）
    conn.exec(`
      CREATE TABLE chat_sessions_new (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        title TEXT,
        model TEXT,
        provider TEXT
      )
    `);

    conn.exec(`
      INSERT INTO chat_sessions_new (id, created_at, updated_at, title, model, provider)
      SELECT id, created_at, updated_at, title, model, provider FROM chat_sessions
    `);

    conn.exec('DROP TABLE chat_sessions');
    conn.exec('ALTER TABLE chat_sessions_new RENAME TO chat_sessions');

    conn.exec('DROP TABLE IF EXISTS canvases');
  }
}