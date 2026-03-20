/**
 * V3 添加 ComfyUI 工作流表迁移
 */

import Database from 'better-sqlite3';
import { Migration } from './index';

export class V3AddComfyWorkflow implements Migration {
  version = 3;
  description = '添加 ComfyUI 工作流表';

  up(conn: Database.Database): void {
    // 创建 comfy_workflows 表
    conn.exec(`
      CREATE TABLE IF NOT EXISTS comfy_workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        api_json TEXT,
        description TEXT DEFAULT '',
        inputs TEXT,
        outputs TEXT,
        created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);

    conn.exec(`
      CREATE INDEX IF NOT EXISTS idx_comfy_workflows_updated_at ON comfy_workflows(updated_at DESC, id DESC)
    `);
  }

  down(conn: Database.Database): void {
    conn.exec('DROP TABLE IF EXISTS comfy_workflows');
  }
}