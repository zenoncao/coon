/**
 * 配置模型定义
 * 定义应用配置相关的类型结构
 */

import { Literal } from 'smol-toml';

// 模型配置类型
export interface ModelConfig {
  type?: 'text' | 'image' | 'video';
  is_custom?: boolean;
  is_disabled?: boolean;
}

// Provider 配置类型
export interface ProviderConfig {
  url: string;
  api_key: string;
  max_tokens?: number;
  models: Record<string, ModelConfig>;
  is_custom?: boolean;
}

// 应用配置类型
export type AppConfig = Record<string, ProviderConfig>;

// 配置更新请求类型
export interface ConfigUpdate {
  llm?: {
    model: string;
    base_url: string;
    api_key: string;
    max_tokens: number;
    temperature: number;
  };
}

// 模型信息类型
export interface ModelInfo {
  provider: string;
  model: string;  // 对于工具类型，这是函数名
  url: string;
  type: 'text' | 'image' | 'tool' | 'video';
}