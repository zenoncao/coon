/**
 * 工具服务模块
 *
 * 该模块负责管理工具的注册和初始化，包括：
 * - 图像生成工具
 * - 视频生成工具
 * - ComfyUI 动态工具
 * - 系统工具（如写计划）
 */

import { configService } from './config.service';
import { dbService } from './db.service';
import { ToolInfo } from '../models';

// 工具映射
const TOOL_MAPPING: Record<string, ToolInfo> = {
  // 图像生成工具（简化实现）
  generate_image_by_gpt_image_1_jaaz: {
    display_name: 'GPT Image 1',
    type: 'image',
    provider: 'jaaz',
    tool_function: null, // 将在后续实现
  },
  generate_image_by_imagen_4_jaaz: {
    display_name: 'Imagen 4',
    type: 'image',
    provider: 'jaaz',
    tool_function: null,
  },
  generate_image_by_flux_kontext_pro_jaaz: {
    display_name: 'Flux Kontext Pro',
    type: 'image',
    provider: 'jaaz',
    tool_function: null,
  },
  // 视频生成工具（简化实现）
  generate_video_by_seedance_v1_jaaz: {
    display_name: 'Doubao Seedance v1',
    type: 'video',
    provider: 'jaaz',
    tool_function: null,
  },
  generate_video_by_hailuo_02_jaaz: {
    display_name: 'Hailuo 02',
    type: 'video',
    provider: 'jaaz',
    tool_function: null,
  },
};

/**
 * 工具服务类
 */
export class ToolService {
  private tools: Record<string, ToolInfo> = {};

  constructor() {
    this.registerRequiredTools();
  }

  /**
   * 注册必须的工具
   */
  private registerRequiredTools(): void {
    // 注册写计划工具
    this.tools['write_plan'] = {
      provider: 'system',
      tool_function: {
        name: 'write_plan',
        description: '编写执行计划',
        call: async (plan: any) => JSON.stringify(plan),
      },
    };
  }

  /**
   * 注册单个工具
   */
  registerTool(toolId: string, toolInfo: ToolInfo): void {
    if (toolId in this.tools) {
      console.log(`🔄 工具已注册: ${toolId}`);
      return;
    }

    this.tools[toolId] = toolInfo;
  }

  /**
   * 初始化工具服务
   */
  async initialize(): Promise<void> {
    this.clearTools();

    try {
      const appConfig = configService.getConfig();

      for (const [providerName, providerConfig] of Object.entries(appConfig)) {
        // 注册所有有 API key 的工具
        if (providerConfig.api_key) {
          for (const [toolId, toolInfo] of Object.entries(TOOL_MAPPING)) {
            if (toolInfo.provider === providerName) {
              this.registerTool(toolId, toolInfo);
            }
          }
        }
      }

      // 注册 ComfyUI 工作流工具
      if (appConfig.comfyui?.url) {
        await this.registerComfyTools();
      }
    } catch (error) {
      console.error('❌ 初始化工具服务失败:', error);
    }
  }

  /**
   * 获取工具
   */
  getTool(toolName: string): any | null {
    const toolInfo = this.tools[toolName];
    return toolInfo?.tool_function || null;
  }

  /**
   * 移除工具
   */
  removeTool(toolId: string): void {
    delete this.tools[toolId];
  }

  /**
   * 获取所有工具
   */
  getAllTools(): Record<string, ToolInfo> {
    return { ...this.tools };
  }

  /**
   * 清空工具
   */
  clearTools(): void {
    this.tools = {};
    this.registerRequiredTools();
  }

  /**
   * 注册 ComfyUI 工作流工具
   */
  private async registerComfyTools(): Promise<void> {
    try {
      const workflows = dbService.listComfyWorkflows();

      for (const workflow of workflows) {
        const uniqueName = `comfyui_${workflow.name}`;

        this.registerTool(uniqueName, {
          provider: 'comfyui',
          tool_function: {
            name: uniqueName,
            description: workflow.description || `ComfyUI workflow: ${workflow.name}`,
            call: async () => 'ComfyUI workflow executed',
          },
          display_name: workflow.name,
          type: 'image',
        });
      }
    } catch (error) {
      console.error('[comfy_dynamic] 注册 ComfyUI 工具失败:', error);
    }
  }
}

// 创建全局工具服务实例
export const toolService = new ToolService();