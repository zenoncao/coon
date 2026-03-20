/**
 * 魔法生成服务模块
 *
 * 该模块负责处理魔法生成请求，包括：
 * - 解析请求数据
 * - 创建魔法会话
 * - 调用 Jaaz 响应生成
 * - 流任务生命周期管理
 * - WebSocket 通知
 */

import { dbService } from './db.service';
import { sendToWebsocket } from './websocket.service';
import { addStreamTask, removeStreamTask } from './stream.service';

/**
 * 处理魔法生成请求
 *
 * @param data - 魔法生成请求数据
 */
export async function handleMagic(data: Record<string, any>): Promise<void> {
  // 提取字段
  const messages: Record<string, any>[] = data.messages || [];
  const sessionId: string = data.session_id || '';
  const canvasId: string = data.canvas_id || '';

  // 如果只有一条消息，创建新的魔法会话
  if (messages.length === 1) {
    const prompt = messages[0].content || '';
    const title = typeof prompt === 'string' ? prompt.slice(0, 200) : '';

    dbService.createChatSession(sessionId, 'gpt', 'jaaz', canvasId, title);
  }

  // 保存用户消息
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
    // 处理魔法生成
    await processMagicGeneration(messages, sessionId, canvasId, isCancelled);
  } catch (error) {
    if (isCancelled) {
      console.log(`🛑 魔法生成会话 ${sessionId} 已取消`);
    } else {
      console.error('处理魔法生成时出错:', error);
    }
  } finally {
    task.done = true;
    removeStreamTask(sessionId);

    // 通知前端处理完成
    await sendToWebsocket(sessionId, { type: 'done' });
  }

  console.log('✨ magic_service 处理完成');
}

/**
 * 处理魔法生成
 *
 * @param messages - 消息列表
 * @param sessionId - 会话 ID
 * @param canvasId - 画布 ID
 * @param isCancelled - 是否已取消
 */
async function processMagicGeneration(
  messages: Record<string, any>[],
  sessionId: string,
  canvasId: string,
  isCancelled: boolean
): Promise<void> {
  // 简化实现 - 生成简单的响应
  // 完整实现需要集成 Jaaz API
  const aiResponse = {
    role: 'assistant',
    content: '魔法生成功能正在开发中...',
  };

  // 保存 AI 响应到数据库
  dbService.createMessage(sessionId, 'assistant', JSON.stringify(aiResponse));

  // 发送消息到前端
  const allMessages = [...messages, aiResponse];
  await sendToWebsocket(sessionId, { type: 'all_messages', messages: allMessages });
}