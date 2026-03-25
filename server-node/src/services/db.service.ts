/**
 * 数据库服务模块
 *
 * 该模块负责管理应用程序的数据库操作，包括：
 * - SQLite 数据库初始化
 * - 画布 CRUD 操作
 * - 聊天会话管理
 * - 消息存储
 * - ComfyUI 工作流管理
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { USER_DATA_DIR } from './config.service';
import { MigrationManager, CURRENT_VERSION } from './migrations/manager';

// 数据库文件路径
const DB_PATH = path.join(USER_DATA_DIR, 'localmanus.db');

/**
 * 数据库服务类
 * 使用 better-sqlite3 进行同步数据库操作
 */
export class DatabaseService {
  private dbPath: string;
  private db!: Database.Database;
  private migrationManager: MigrationManager;

  constructor() {
    this.dbPath = DB_PATH;
    this._ensureDbDirectory();
    this.migrationManager = new MigrationManager();
    this._initDb();
  }

  /**
   * 确保数据库目录存在
   */
  private _ensureDbDirectory(): void {
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  /**
   * 初始化数据库
   */
  private _initDb(): void {
    this.db = new Database(this.dbPath);

    // 创建版本表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS db_version (
        version INTEGER PRIMARY KEY
      )
    `);

    // 获取当前版本
    const row = this.db.prepare('SELECT version FROM db_version').get() as { version: number } | undefined;
    console.log('本地数据库版本:', row?.version, '最新版本:', CURRENT_VERSION);

    if (row === undefined) {
      // 首次设置 - 从版本 0 开始
      this.db.exec('INSERT INTO db_version (version) VALUES (0)');
      this.migrationManager.migrate(this.db, 0, CURRENT_VERSION);
    } else if (row.version < CURRENT_VERSION) {
      console.log('迁移数据库从版本', row.version, '到', CURRENT_VERSION);
      this.migrationManager.migrate(this.db, row.version, CURRENT_VERSION);
    }
  }

  /**
   * 创建画布
   */
  createCanvas(id: string, name: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO canvases (id, name)
      VALUES (?, ?)
    `);
    stmt.run(id, name);
  }

  /**
   * 获取所有画布列表
   */
  listCanvases(): any[] {
    const stmt = this.db.prepare(`
      SELECT id, name, description, thumbnail, created_at, updated_at
      FROM canvases
      ORDER BY updated_at DESC
    `);
    return stmt.all() as any[];
  }

  /**
   * 创建聊天会话
   */
  createChatSession(id: string, model: string, provider: string, canvasId: string, title?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO chat_sessions (id, model, provider, canvas_id, title)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, model, provider, canvasId, title || null);
  }

  /**
   * 创建消息
   */
  createMessage(sessionId: string, role: string, message: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (session_id, role, message)
      VALUES (?, ?, ?)
    `);
    stmt.run(sessionId, role, message);
  }

  /**
   * 获取聊天历史
   */
  getChatHistory(sessionId: string): any[] {
    const stmt = this.db.prepare(`
      SELECT role, message, id
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY id ASC
    `);
    const rows = stmt.all(sessionId) as any[];

    const messages: any[] = [];
    for (const row of rows) {
      if (row.message) {
        try {
          const msg = JSON.parse(row.message);
          messages.push(msg);
        } catch {
          // 忽略解析错误
        }
      }
    }
    return messages;
  }

  /**
   * 获取会话列表
   */
  listSessions(canvasId?: string): any[] {
    let stmt;
    if (canvasId) {
      stmt = this.db.prepare(`
        SELECT id, title, model, provider, created_at, updated_at
        FROM chat_sessions
        WHERE canvas_id = ?
        ORDER BY updated_at DESC
      `);
      return stmt.all(canvasId) as any[];
    } else {
      stmt = this.db.prepare(`
        SELECT id, title, model, provider, created_at, updated_at
        FROM chat_sessions
        ORDER BY updated_at DESC
      `);
      return stmt.all() as any[];
    }
  }

  /**
   * 保存画布数据
   */
  saveCanvasData(id: string, data: string, thumbnail?: string): void {
    const stmt = this.db.prepare(`
      UPDATE canvases
      SET data = ?, thumbnail = ?, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `);
    stmt.run(data, thumbnail || null, id);
  }

  /**
   * 获取画布数据
   */
  getCanvasData(id: string): { data: any; name: string; sessions: any[] } | null {
    const stmt = this.db.prepare(`
      SELECT data, name
      FROM canvases
      WHERE id = ?
    `);
    const row = stmt.get(id) as { data: string | null; name: string } | undefined;

    const sessions = this.listSessions(id);

    if (row) {
      return {
        data: row.data ? JSON.parse(row.data) : {},
        name: row.name,
        sessions,
      };
    }
    return null;
  }

  /**
   * 删除画布
   */
  deleteCanvas(id: string): void {
    const stmt = this.db.prepare('DELETE FROM canvases WHERE id = ?');
    stmt.run(id);
  }

  /**
   * 重命名画布
   */
  renameCanvas(id: string, name: string): void {
    const stmt = this.db.prepare('UPDATE canvases SET name = ? WHERE id = ?');
    stmt.run(name, id);
  }

  /**
   * 创建 ComfyUI 工作流
   */
  createComfyWorkflow(name: string, apiJson: string, description: string, inputs: string, outputs?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO comfy_workflows (name, api_json, description, inputs, outputs)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(name, apiJson, description, inputs, outputs || null);
  }

  /**
   * 获取所有 ComfyUI 工作流列表
   */
  listComfyWorkflows(): any[] {
    const stmt = this.db.prepare(`
      SELECT id, name, description, api_json, inputs, outputs
      FROM comfy_workflows
      ORDER BY id DESC
    `);
    return stmt.all() as any[];
  }

  /**
   * 删除 ComfyUI 工作流
   */
  deleteComfyWorkflow(id: number): { success: boolean } {
    const stmt = this.db.prepare('DELETE FROM comfy_workflows WHERE id = ?');
    stmt.run(id);
    return { success: true };
  }

  /**
   * 获取 ComfyUI 工作流
   */
  getComfyWorkflow(id: number): any {
    const stmt = this.db.prepare('SELECT api_json FROM comfy_workflows WHERE id = ?');
    const row = stmt.get(id) as { api_json: string } | undefined;

    if (!row) {
      throw new Error(`工作流 ${id} 不存在`);
    }

    try {
      return typeof row.api_json === 'string' ? JSON.parse(row.api_json) : row.api_json;
    } catch (error) {
      throw new Error(`存储的工作流 api_json 不是有效的 JSON: ${error}`);
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.db.close();
  }
}

// 创建全局数据库服务实例
export const dbService = new DatabaseService();