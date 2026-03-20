/**
 * 数据库模型定义
 * 定义数据库表结构相关的类型
 */

// ComfyUI 工作流模型
export interface ComfyWorkflow {
  id: number;
  name: string;
  description: string;
  inputs: string;
  outputs: string;
}

// 画布模型
export interface Canvas {
  id: string;
  name: string;
  data: string | null;
  description: string;
  thumbnail: string;
  created_at: string;
  updated_at: string;
}

// 聊天会话模型
export interface ChatSession {
  id: string;
  canvas_id: string | null;
  created_at: string;
  updated_at: string;
  title: string | null;
  model: string | null;
  provider: string | null;
}

// 聊天消息模型
export interface ChatMessage {
  id: number;
  session_id: string;
  role: string;
  message: string;
  created_at: string;
  updated_at: string;
}