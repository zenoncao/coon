/**
 * 工具模型定义
 * 定义工具相关的类型结构
 */

// 工具信息类型 - 必填字段
export interface ToolInfoRequired {
  tool_function: any;  // LangChain 工具实例
  provider: string;
}

// 工具信息类型 - 可选字段
export interface ToolInfoOptional {
  display_name?: string;
  type?: string;
}

// 完整工具信息类型
export type ToolInfo = ToolInfoRequired & ToolInfoOptional;

// 工具信息 JSON 类型 - 必填字段
export interface ToolInfoJsonRequired {
  provider: string;
  id: string;
}

// 工具信息 JSON 类型
export type ToolInfoJson = ToolInfoJsonRequired & ToolInfoOptional;