/**
 * 设置服务模块
 *
 * 该模块负责管理应用程序的所有配置设置，包括：
 * - 代理配置（proxy settings）
 * - 系统提示词（system prompts）
 * - 其他应用配置项
 *
 * 主要功能：
 * 1. 读取和写入 JSON 格式的设置文件
 * 2. 提供默认设置配置
 * 3. 设置的合并和更新操作
 * 4. 全局设置状态管理
 */

import * as fs from 'fs';
import * as path from 'path';
import { USER_DATA_DIR } from './config.service';

// 默认设置配置模板
const DEFAULT_SETTINGS = {
  proxy: 'system',  // 代理设置：'no_proxy' (不使用代理), 'system' (使用系统代理), 或具体的代理URL地址
  enabled_knowledge: [] as string[],  // 启用的知识库ID列表（保持兼容性）
  enabled_knowledge_data: [] as any[],  // 启用的知识库完整数据列表
};

// 全局设置配置缓存
export let appSettings: typeof DEFAULT_SETTINGS = { ...DEFAULT_SETTINGS };

/**
 * 设置服务类
 * 负责管理应用程序的所有配置设置
 */
export class SettingsService {
  private rootDir: string;
  private settingsFile: string;

  constructor() {
    this.rootDir = path.dirname(path.dirname(path.dirname(__dirname)));
    this.settingsFile = process.env.SETTINGS_PATH || path.join(USER_DATA_DIR, 'settings.json');
  }

  /**
   * 检查设置文件是否存在
   */
  async existsSettings(): Promise<boolean> {
    return fs.existsSync(this.settingsFile);
  }

  /**
   * 获取所有设置配置
   */
  getSettings(): typeof DEFAULT_SETTINGS {
    try {
      if (!fs.existsSync(this.settingsFile)) {
        this.createDefaultSettings();
      }

      // 读取 JSON 配置文件
      const content = require('fs').readFileSync(this.settingsFile, 'utf-8');
      const settings = JSON.parse(content);

      // 与默认设置合并
      const mergedSettings = { ...DEFAULT_SETTINGS };
      for (const [key, value] of Object.entries(settings)) {
        if (key in mergedSettings && typeof mergedSettings[key as keyof typeof DEFAULT_SETTINGS] === 'object' && typeof value === 'object') {
          // 对于对象类型的设置，进行深度合并
          (mergedSettings as any)[key] = { ...(mergedSettings as any)[key], ...value };
        } else {
          (mergedSettings as any)[key] = value;
        }
      }

      // 更新全局设置缓存
      appSettings = mergedSettings;
      return mergedSettings;
    } catch (error) {
      console.error('加载设置时出错:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * 获取原始设置（内部使用）
   */
  getRawSettings(): typeof DEFAULT_SETTINGS {
    try {
      if (!fs.existsSync(this.settingsFile)) {
        this.createDefaultSettings();
      }

      const content = require('fs').readFileSync(this.settingsFile, 'utf-8');
      const settings = JSON.parse(content);

      const mergedSettings = { ...DEFAULT_SETTINGS };
      for (const [key, value] of Object.entries(settings)) {
        if (key in mergedSettings && typeof mergedSettings[key as keyof typeof DEFAULT_SETTINGS] === 'object' && typeof value === 'object') {
          (mergedSettings as any)[key] = { ...(mergedSettings as any)[key], ...value };
        } else {
          (mergedSettings as any)[key] = value;
        }
      }

      appSettings = mergedSettings;
      return mergedSettings;
    } catch (error) {
      console.error('加载原始设置时出错:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * 获取代理配置
   */
  getProxyConfig(): string {
    const settings = this.getRawSettings();
    return settings.proxy || '';
  }

  /**
   * 获取启用的知识库ID列表
   */
  getEnabledKnowledgeIds(): string[] {
    const settings = this.getRawSettings();
    return settings.enabled_knowledge || [];
  }

  /**
   * 更新启用的知识库列表
   */
  async updateEnabledKnowledge(knowledgeIds: string[]): Promise<{ status: string; message: string }> {
    return this.updateSettings({ enabled_knowledge: knowledgeIds });
  }

  /**
   * 获取启用的知识库完整数据列表
   */
  getEnabledKnowledgeData(): any[] {
    const settings = this.getRawSettings();
    return settings.enabled_knowledge_data || [];
  }

  /**
   * 更新启用的知识库完整数据
   */
  async updateEnabledKnowledgeData(knowledgeDataList: any[]): Promise<{ status: string; message: string }> {
    const knowledgeIds = knowledgeDataList
      .filter(kb => kb.id)
      .map(kb => kb.id);

    return this.updateSettings({
      enabled_knowledge: knowledgeIds,
      enabled_knowledge_data: knowledgeDataList,
    });
  }

  /**
   * 创建默认设置文件
   */
  createDefaultSettings(): void {
    try {
      const settingsDir = path.dirname(this.settingsFile);
      if (!fs.existsSync(settingsDir)) {
        require('fs').mkdirSync(settingsDir, { recursive: true });
      }

      require('fs').writeFileSync(
        this.settingsFile,
        JSON.stringify(DEFAULT_SETTINGS, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('创建默认设置时出错:', error);
    }
  }

  /**
   * 更新设置配置
   */
  async updateSettings(data: Partial<typeof DEFAULT_SETTINGS>): Promise<{ status: string; message: string }> {
    try {
      // 加载现有设置
      let existingSettings = { ...DEFAULT_SETTINGS };
      if (fs.existsSync(this.settingsFile)) {
        try {
          const content = require('fs').readFileSync(this.settingsFile, 'utf-8');
          existingSettings = JSON.parse(content);
        } catch (error) {
          console.error('读取现有设置时出错:', error);
        }
      }

      // 合并新数据
      for (const [key, value] of Object.entries(data)) {
        if (key in existingSettings && typeof existingSettings[key as keyof typeof DEFAULT_SETTINGS] === 'object' && typeof value === 'object') {
          // 对于对象类型，进行深度合并
          (existingSettings as any)[key] = { ...(existingSettings as any)[key], ...value };
        } else {
          (existingSettings as any)[key] = value;
        }
      }

      // 确保目录存在
      const settingsDir = path.dirname(this.settingsFile);
      if (!fs.existsSync(settingsDir)) {
        require('fs').mkdirSync(settingsDir, { recursive: true });
      }

      // 保存更新后的设置
      require('fs').writeFileSync(
        this.settingsFile,
        JSON.stringify(existingSettings, null, 2),
        'utf-8'
      );

      // 更新全局设置缓存
      appSettings = existingSettings;

      return { status: 'success', message: '设置更新成功' };
    } catch (error) {
      console.error('更新设置时出错:', error);
      return { status: 'error', message: String(error) };
    }
  }
}

// 创建全局设置服务实例
export const settingsService = new SettingsService();

// 在模块导入时初始化设置
settingsService.getRawSettings();