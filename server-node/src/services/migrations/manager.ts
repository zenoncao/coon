/**
 * 数据库迁移管理器
 *
 * 该模块负责管理数据库迁移，包括：
 * - 迁移版本管理
 * - 迁移执行
 */

import Database from 'better-sqlite3';
import { Migration } from './index';
import { V1InitialSchema } from './v1-initial-schema';
import { V2AddCanvases } from './v2-add-canvases';
import { V3AddComfyWorkflow } from './v3-add-comfy-workflow';

// 当前数据库版本
export const CURRENT_VERSION = 3;

// 所有迁移配置
const ALL_MIGRATIONS: { version: number; migration: new () => Migration }[] = [
  { version: 1, migration: V1InitialSchema },
  { version: 2, migration: V2AddCanvases },
  { version: 3, migration: V3AddComfyWorkflow },
];

/**
 * 迁移管理器类
 */
export class MigrationManager {
  /**
   * 获取需要应用的迁移列表
   */
  getMigrationsToApply(currentVersion: number, targetVersion: number): { version: number; migration: Migration }[] {
    return ALL_MIGRATIONS
      .filter(m => m.version > currentVersion && m.version <= targetVersion)
      .map(m => ({
        version: m.version,
        migration: new m.migration(),
      }));
  }

  /**
   * 执行迁移
   */
  migrate(conn: Database.Database, fromVersion: number, toVersion: number): void {
    if (fromVersion < toVersion) {
      console.log('🦄 开始迁移', fromVersion, '->', toVersion);
      const migrations = this.getMigrationsToApply(fromVersion, toVersion);
      console.log('🦄 需要执行的迁移:', migrations.map(m => m.version));

      for (const { migration } of migrations) {
        console.log(`应用迁移 ${migration.version}: ${migration.description}`);
        migration.up(conn);
        conn.prepare('UPDATE db_version SET version = ?').run(migration.version);
      }
    }
  }
}