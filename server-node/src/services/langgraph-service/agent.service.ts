/**
 * 多智能体服务模块
 *
 * 该模块负责协调多个智能体处理聊天请求
 */

import { ModelInfo, ToolInfoJson } from '../../models';
import { AgentManager } from './agent.manager';
import { StreamProcessor } from './stream.processor';
import { sendToWebsocket } from '../websocket.service';
import { configService } from '../config.service';

/**
 * 修复聊天历史中不完整的工具调用
 *
 * 根据 LangGraph 文档建议，移除没有对应 ToolMessage 的 tool_calls
 */
function fixChatHistory(messages: Record<string, any>[]): Record<string, any>[] {
  if (!messages || messages.length === 0) {
    return messages;
  }

  const fixedMessages: Record<string, any>[] = [];
  const toolCallIds = new Set<string>();

  // 第一遍：收集所有 ToolMessage 的 tool_call_id
  for (const msg of messages) {
    if (msg.role === 'tool' && msg.tool_call_id) {
      toolCallIds.add(msg.tool_call_id);
    }
  }

  // 第二遍：修复 AIMessage 中的 tool_calls
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      // 过滤掉没有对应 ToolMessage 的 tool_calls
      const validToolCalls: Record<string, any>[] = [];
      const removedCalls: string[] = [];

      for (const toolCall of msg.tool_calls) {
        const toolCallId = toolCall.id;
        if (toolCallIds.has(toolCallId)) {
          validToolCalls.push(toolCall);
        } else if (toolCallId) {
          removedCalls.push(toolCallId);
        }
      }

      // 记录修复信息
      if (removedCalls.length > 0) {
        console.log(`🔧 修复消息历史：移除了 ${removedCalls.length} 个不完整的工具调用: ${removedCalls.join(', ')}`);
      }

      // 更新消息
      if (validToolCalls.length > 0) {
        const msgCopy = { ...msg, tool_calls: validToolCalls };
        fixedMessages.push(msgCopy);
      } else if (msg.content) {
        // 如果没有有效的 tool_calls 但有 content，保留消息
        const msgCopy = { ...msg };
        delete msgCopy.tool_calls;
        fixedMessages.push(msgCopy);
      }
      // 如果既没有有效 tool_calls 也没有 content，跳过这条消息
    } else {
      // 非 assistant 消息或没有 tool_calls 的消息直接保留
      fixedMessages.push(msg);
    }
  }

  return fixedMessages;
}

/**
 * 创建文本模型实例
 */
function createTextModel(textModel: ModelInfo): any {
  const model = textModel.model;
  const provider = textModel.provider;
  const url = textModel.url;

  const providerConfig = configService.getConfig()[provider] || {};
  const apiKey = providerConfig.api_key || '';

  // 返回模型配置信息
  // 完整实现需要创建实际的 LangChain 模型实例
  return {
    model,
    provider,
    url,
    apiKey,
  };
}

/**
 * 处理错误
 */
async function handleError(error: Error, sessionId: string): Promise<void> {
  console.error('langgraph_agent 出错:', error);

  await sendToWebsocket(sessionId, {
    type: 'error',
    error: error.message,
  });
}

/**
 * 多智能体处理函数
 *
 * @param messages - 消息历史
 * @param canvasId - 画布 ID
 * @param sessionId - 会话 ID
 * @param textModel - 文本模型配置
 * @param toolList - 工具模型配置列表
 * @param systemPrompt - 系统提示词
 */
export async function langgraphMultiAgent(
  messages: Record<string, any>[],
  canvasId: string,
  sessionId: string,
  textModel: ModelInfo,
  toolList: ToolInfoJson[],
  systemPrompt?: string
): Promise<void> {
  try {
    // 1. 修复消息历史
    const fixedMessages = fixChatHistory(messages);

    // 2. 创建文本模型
    const modelInstance = createTextModel(textModel);

    // 3. 创建智能体
    const agents = AgentManager.createAgents(modelInstance, toolList, systemPrompt || '');
    const agentNames = agents.map(a => a.name);

    console.log('👇 agent_names', agentNames);

    const lastAgent = AgentManager.getLastActiveAgent(fixedMessages, agentNames);
    console.log('👇 last_agent', lastAgent);

    // 4. 创建上下文
    const context = {
      canvas_id: canvasId,
      session_id: sessionId,
      tool_list: toolList,
    };

    // 5. 流处理
    const processor = new StreamProcessor(sessionId);
    await processor.processStream(agents, fixedMessages, context);

  } catch (error) {
    await handleError(error as Error, sessionId);
  }
}