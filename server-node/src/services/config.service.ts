/**
 * 配置服务模块
 *
 * 该模块负责管理应用程序的 Provider 配置，包括：
 * - TOML 格式的配置文件读写
 * - 默认 Provider 配置管理
 * - 配置更新和验证
 * - Jaaz URL 自动设置
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse, stringify } from 'smol-toml';
import { AppConfig, ProviderConfig, ModelConfig } from '../models/config.model';

// 用户数据目录路径
const SERVER_DIR = path.dirname(path.dirname(__dirname));
export const USER_DATA_DIR = process.env.USER_DATA_DIR || path.join(SERVER_DIR, 'user_data');
export const FILES_DIR = path.join(USER_DATA_DIR, 'files');

// 支持的图像格式
export const IMAGE_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif'];

// 支持的视频格式
export const VIDEO_FORMATS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv'];

// 默认 Provider 配置
const DEFAULT_PROVIDERS_CONFIG: AppConfig = {
  jaaz: {
    models: {
      // 文本模型
      'gpt-4o': { type: 'text' },
      'gpt-4o-mini': { type: 'text' },
      'deepseek/deepseek-chat-v3-0324': { type: 'text' },
      'anthropic/claude-sonnet-4': { type: 'text' },
      'anthropic/claude-3.7-sonnet': { type: 'text' },
    },
    url: (process.env.BASE_API_URL || 'https://jaaz.app').replace(/\/$/, '') + '/api/v1/',
    api_key: '',
    max_tokens: 8192,
  },
  comfyui: {
    models: {},
    url: 'http://127.0.0.1:8188',
    api_key: '',
  },
  ollama: {
    models: {},
    url: 'http://localhost:11434',
    api_key: '',
    max_tokens: 8192,
  },
  openai: {
    models: {
      'gpt-4o': { type: 'text' },
      'gpt-4o-mini': { type: 'text' },
    },
    url: 'https://api.openai.com/v1/',
    api_key: '',
    max_tokens: 8192,
  },
};

/**
 * 配置服务类
 * 负责管理应用程序的 Provider 配置
 */
export class ConfigService {
  private appConfig: AppConfig;
  private configFile: string;
  public initialized: boolean;

  constructor() {
    // 深拷贝默认配置
    this.appConfig = JSON.parse(JSON.stringify(DEFAULT_PROVIDERS_CONFIG));
    this.configFile = process.env.CONFIG_PATH || path.join(USER_DATA_DIR, 'config.toml');
    this.initialized = false;
  }

  /**
   * 获取正确的 Jaaz URL
   */
  private getJaazUrl(): string {
    return (process.env.BASE_API_URL || 'https://jaaz.app').replace(/\/$/, '') + '/api/v1/';
  }

  /**
   * 初始化配置服务
   */
  async initialize(): Promise<void> {
    try {
      // 确保配置目录存在
      const configDir = path.dirname(this.configFile);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // 检查配置文件是否存在
      if (!this.existsConfig()) {
        console.log(`配置文件不存在于 ${this.configFile}，创建默认配置`);
        // 创建默认配置文件
        const tomlContent = stringify(this.appConfig as any);
        fs.writeFileSync(this.configFile, tomlContent, 'utf-8');
        console.log(`默认配置文件已创建于 ${this.configFile}`);
        this.initialized = true;
        return;
      }

      // 读取配置文件
      const content = fs.readFileSync(this.configFile, 'utf-8');
      const config: AppConfig = parse(content) as unknown as AppConfig;

      // 合并配置
      for (const [provider, providerConfig] of Object.entries(config)) {
        if (!(provider in DEFAULT_PROVIDERS_CONFIG)) {
          providerConfig.is_custom = true;
        }
        this.appConfig[provider] = providerConfig;

        // 获取默认模型配置
        const defaultModels = DEFAULT_PROVIDERS_CONFIG[provider]?.models || {};

        // 处理模型配置
        for (const [modelName, modelConfig] of Object.entries(providerConfig.models || {})) {
          // 只有文本模型可以自定义添加
          if (modelConfig.type === 'text' && !(modelName in defaultModels)) {
            defaultModels[modelName] = modelConfig as ModelConfig;
            defaultModels[modelName].is_custom = true;
          }
        }
        this.appConfig[provider].models = defaultModels;
      }

      // 确保 Jaaz URL 始终正确
      if ('jaaz' in this.appConfig) {
        this.appConfig.jaaz.url = this.getJaazUrl();
      }
    } catch (error) {
      console.error('加载配置时出错:', error);
    } finally {
      this.initialized = true;
    }
  }

  /**
   * 获取配置
   */
  getConfig(): AppConfig {
    if ('jaaz' in this.appConfig) {
      this.appConfig.jaaz.url = this.getJaazUrl();
    }
    return this.appConfig;
  }

  /**
   * 更新配置
   */
  async updateConfig(data: AppConfig): Promise<{ status: string; message: string }> {
    try {
      // 确保 Jaaz URL 正确
      if ('jaaz' in data) {
        data.jaaz.url = this.getJaazUrl();
      }

      // 确保目录存在
      const configDir = path.dirname(this.configFile);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // 写入配置文件
      const tomlContent = stringify(data as any);
      fs.writeFileSync(this.configFile, tomlContent, 'utf-8');

      this.appConfig = data;

      return {
        status: 'success',
        message: '配置更新成功',
      };
    } catch (error) {
      console.error('更新配置时出错:', error);
      return {
        status: 'error',
        message: String(error),
      };
    }
  }

  /**
   * 检查配置文件是否存在
   */
  existsConfig(): boolean {
    return fs.existsSync(this.configFile);
  }
}

// 创建全局配置服务实例
export const configService = new ConfigService();