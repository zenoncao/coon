/**
 * 流式处理器
 *
 * 负责处理智能体的流式输出
 */

import { dbService } from '../db.service';
import { sendToWebsocket } from '../websocket.service';

/**
 * 流式处理器类
 */
export class StreamProcessor {
  private sessionId: string;
  private lastSavedMessageIndex: number;
  private lastStreamingToolCallId: string | null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.lastSavedMessageIndex = 0;
    this.lastStreamingToolCallId = null;
  }

  /**
   * 处理流式响应
   *
   * @param agents - 智能体配置列表
   * @param messages - 消息列表
   * @param context - 上下文信息
   */
  async processStream(
    agents: any[],
    messages: Record<string, any>[],
    context: Record<string, any>
  ): Promise<void> {
    this.lastSavedMessageIndex = messages.length - 1;

    try {
      // 简化实现 - 直接生成响应
      // 完整实现需要集成 LangChain.js 的流式处理
      const response = await this.generateResponse(agents, messages, context);

      // 处理响应
      await this.handleResponse(response);
    } catch (error) {
      console.error('处理流时出错:', error);
      await sendToWebsocket(this.sessionId, {
        type: 'error',
        error: String(error),
      });
    }
  }

  /**
   * 生成响应（简化实现）
   */
  private async generateResponse(
    agents: any[],
    messages: Record<string, any>[],
    context: Record<string, any>
  ): Promise<Record<string, any>> {
    // 简化实现 - 返回基本响应
    // 完整实现需要调用 LangChain.js
    const lastMessage = messages[messages.length - 1];

    return {
      role: 'assistant',
      content: `我收到了您的消息。这是一个简化的响应实现。完整功能需要集成 LangChain.js。\n\n您的消息: ${typeof lastMessage?.content === 'string' ? lastMessage.content.slice(0, 100) : 'N/A'}`,
    };
  }

  /**
   * 处理响应
   */
  private async handleResponse(response: Record<string, any>): Promise<void> {
    // 发送文本内容
    if (response.content) {
      await sendToWebsocket(this.sessionId, {
        type: 'delta',
        text: response.content,
      });
    }

    // 保存消息到数据库
    dbService.createMessage(this.sessionId, 'assistant', JSON.stringify(response));

    // 发送完成通知
    await sendToWebsocket(this.sessionId, {
      type: 'done',
    });
  }

  /**
   * 处理工具调用
   */
  private async handleToolCalls(toolCalls: any[]): Promise<void> {
    for (const toolCall of toolCalls) {
      const toolName = toolCall.name || toolCall.function?.name;

      await sendToWebsocket(this.sessionId, {
        type: 'tool_call',
        id: toolCall.id,
        name: toolName,
        arguments: toolCall.arguments || '{}',
      });
    }
  }

  /**
   * 处理工具调用结果
   */
  private async handleToolCallResult(toolCallId: string, result: any): Promise<void> {
    await sendToWebsocket(this.sessionId, {
      type: 'tool_call_result',
      id: toolCallId,
      message: result,
    });
  }
}