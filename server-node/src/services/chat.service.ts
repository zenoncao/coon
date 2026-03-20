/**
 * 聊天服务模块
 *
 * 该模块负责处理聊天请求，包括：
 * - 解析聊天数据
 * - 创建聊天会话
 * - 保存消息到数据库
 * - 调用多智能体系统处理请求
 * - 流任务生命周期管理
 * - WebSocket 通知
 */

import { dbService } from './db.service';
import { sendToWebsocket } from './websocket.service';
import { addStreamTask, removeStreamTask } from './stream.service';
import { langgraphMultiAgent } from './langgraph-service/agent.service';
import { ModelInfo, ToolInfoJson } from '../models';

/**
 * 处理聊天请求
 *
 * @param data - 聊天请求数据
 */
export async function handleChat(data: Record<string, any>): Promise<void> {
  // 提取字段
  const messages: Record<string, any>[] = data.messages || [];
  const sessionId: string = data.session_id || '';
  const canvasId: string = data.canvas_id || '';
  const textModel: ModelInfo = data.text_model || {};
  const toolList: ToolInfoJson[] = data.tool_list || [];

  console.log('👇 chat_service 收到 tool_list', toolList);

  // 系统提示词
  const systemPrompt: string | undefined = data.system_prompt;

  // 如果只有一条消息，创建新的聊天会话
  if (messages.length === 1) {
    const prompt = messages[0].content || '';
    const title = typeof prompt === 'string' ? prompt.slice(0, 200) : '';

    dbService.createChatSession(
      sessionId,
      textModel.model || '',
      textModel.provider || '',
      canvasId,
      title
    );
  }

  // 保存最后一条消息
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    dbService.createMessage(sessionId, lastMessage.role || 'user', JSON.stringify(lastMessage));
  }

  // 创建取消标志和任务
  let isCancelled = false;
  const task = {
    cancel: () => {
      isCancelled = true;
    },
    done: false,
  };

  // 注册任务
  addStreamTask(sessionId, task);

  try {
    // 调用多智能体处理
    await langgraphMultiAgent(messages, canvasId, sessionId, textModel, toolList, systemPrompt);
  } catch (error) {
    if (isCancelled) {
      console.log(`🛑 会话 ${sessionId} 已取消`);
    } else {
      console.error('处理聊天时出错:', error);
    }
  } finally {
    task.done = true;
    removeStreamTask(sessionId);

    // 通知前端处理完成
    await sendToWebsocket(sessionId, { type: 'done' });
  }
}