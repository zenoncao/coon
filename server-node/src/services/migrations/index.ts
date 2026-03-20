/**
 * 数据库迁移接口定义
 */

import Database from 'better-sqlite3';

/**
 * 迁移接口
 * 所有迁移类都必须实现此接口
 */
export interface Migration {
  /** 迁移版本号 */
  version: number;
  /** 迁移描述 */
  description: string;
  /** 执行迁移 */
  up(conn: Database.Database): void;
  /** 回滚迁移（可选） */
  down?(conn: Database.Database): void;
}