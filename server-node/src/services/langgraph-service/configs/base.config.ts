/**
 * 智能体配置基类
 *
 * 此模块定义智能体配置的基础结构和工具
 */

import { ToolInfoJson } from '../../../models';

/**
 * 切换智能体配置
 */
export interface HandoffConfig {
  agent_name: string;
  description: string;
}

/**
 * 智能体配置基类
 */
export class BaseAgentConfig {
  name: string;
  tools: ToolInfoJson[];
  systemPrompt: string;
  handoffs: HandoffConfig[];

  constructor(
    name: string,
    tools: ToolInfoJson[],
    systemPrompt: string,
    handoffs?: HandoffConfig[]
  ) {
    this.name = name;
    this.tools = tools;
    this.systemPrompt = systemPrompt;
    this.handoffs = handoffs || [];
  }
}