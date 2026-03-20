/**
 * 智能体管理器
 *
 * 负责创建和管理所有智能体
 */

import { ModelInfo, ToolInfoJson } from '../../models';
import { BaseAgentConfig, PlannerAgentConfig, ImageVideoCreatorAgentConfig } from './configs';
import { toolService } from '../tool.service';

/**
 * 智能体信息接口
 */
export interface AgentInfo {
  name: string;
  config: BaseAgentConfig;
}

/**
 * 智能体管理器类
 */
export class AgentManager {
  /**
   * 创建所有智能体
   *
   * @param model - 语言模型实例
   * @param toolList - 工具列表
   * @param systemPrompt - 系统提示词
   * @returns 智能体配置列表
   */
  static createAgents(
    model: any,
    toolList: ToolInfoJson[],
    systemPrompt: string = ''
  ): AgentInfo[] {
    // 为不同类型的智能体过滤合适的工具
    const imageTools = toolList.filter(tool => tool.type === 'image');
    const videoTools = toolList.filter(tool => tool.type === 'video');

    console.log(`📸 图像工具: ${imageTools.length} 个`);
    console.log(`🎬 视频工具: ${videoTools.length} 个`);

    // 创建规划智能体配置
    const plannerConfig = new PlannerAgentConfig();

    // 创建图像视频创建智能体配置
    const imageVideoCreatorConfig = new ImageVideoCreatorAgentConfig(toolList);

    return [
      { name: plannerConfig.name, config: plannerConfig },
      { name: imageVideoCreatorConfig.name, config: imageVideoCreatorConfig },
    ];
  }

  /**
   * 获取最后活跃的智能体
   *
   * @param messages - 消息历史
   * @param agentNames - 智能体名称列表
   * @returns 最后活跃的智能体名称，如果没有则返回 null
   */
  static getLastActiveAgent(
    messages: Record<string, any>[],
    agentNames: string[]
  ): string | null {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === 'assistant') {
        const messageName = message.name;
        if (messageName && agentNames.includes(messageName)) {
          return messageName;
        }
      }
    }
    return null;
  }

  /**
   * 获取智能体的业务工具
   *
   * @param config - 智能体配置
   * @returns 工具列表
   */
  static getBusinessTools(config: BaseAgentConfig): any[] {
    const tools: any[] = [];

    for (const toolJson of config.tools) {
      const tool = toolService.getTool(toolJson.id);
      if (tool) {
        tools.push(tool);
      }
    }

    return tools;
  }
}