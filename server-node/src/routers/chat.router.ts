/**
 * 聊天路由模块
 *
 * 提供聊天相关的 API 端点：
 * - POST /api/chat - 发送聊天消息
 * - POST /api/cancel/:sessionId - 取消聊天
 * - POST /api/magic - 魔法生成请求
 * - POST /api/magic/cancel/:sessionId - 取消魔法生成
 */

import { Router, Request, Response } from 'express';
import { handleChat } from '../services/chat.service';
import { handleMagic } from '../services/magic.service';
import { getStreamTask } from '../services/stream.service';

export const router = Router();

/**
 * 处理聊天请求
 */
router.post('/chat', async (req: Request, res: Response) => {
  const data = req.body;
  await handleChat(data);
  res.json({ status: 'done' });
});

/**
 * 取消正在进行的流任务
 */
router.post('/cancel/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const task = getStreamTask(sessionId);

  if (task && !task.done) {
    task.cancel();
    res.json({ status: 'cancelled' });
  } else {
    res.json({ status: 'not_found_or_done' });
  }
});

/**
 * 处理魔法生成请求
 */
router.post('/magic', async (req: Request, res: Response) => {
  const data = req.body;
  await handleMagic(data);
  res.json({ status: 'done' });
});

/**
 * 取消正在进行的魔法生成任务
 */
router.post('/magic/cancel/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const task = getStreamTask(sessionId);

  if (task && !task.done) {
    task.cancel();
    res.json({ status: 'cancelled' });
  } else {
    res.json({ status: 'not_found_or_done' });
  }
});