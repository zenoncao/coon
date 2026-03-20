/**
 * 画布路由模块
 *
 * 提供画布相关的 API 端点：
 * - GET /api/canvas/list - 获取所有画布
 * - POST /api/canvas/create - 创建画布
 * - GET /api/canvas/:id - 获取画布数据
 * - POST /api/canvas/:id/save - 保存画布
 * - POST /api/canvas/:id/rename - 重命名画布
 * - DELETE /api/canvas/:id/delete - 删除画布
 */

import { Router, Request, Response } from 'express';
import { dbService } from '../services/db.service';
import { handleChat } from '../services/chat.service';

export const router = Router();

/**
 * 获取所有画布列表
 */
router.get('/list', async (req: Request, res: Response) => {
  const canvases = dbService.listCanvases();
  res.json(canvases);
});

/**
 * 创建新画布
 */
router.post('/create', async (req: Request, res: Response) => {
  const { canvas_id, name, ...chatData } = req.body;

  // 如果有聊天数据，异步处理
  if (chatData.messages) {
    handleChat(req.body).catch(err => {
      console.error('处理聊天时出错:', err);
    });
  }

  // 创建画布
  dbService.createCanvas(canvas_id, name);

  res.json({ id: canvas_id });
});

/**
 * 获取画布数据
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const canvasData = dbService.getCanvasData(id);
  res.json(canvasData);
});

/**
 * 保存画布
 */
router.post('/:id/save', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, thumbnail } = req.body;

  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  dbService.saveCanvasData(id, dataStr, thumbnail);

  res.json({ id });
});

/**
 * 重命名画布
 */
router.post('/:id/rename', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  dbService.renameCanvas(id, name);

  res.json({ id });
});

/**
 * 删除画布
 */
router.delete('/:id/delete', async (req: Request, res: Response) => {
  const { id } = req.params;

  dbService.deleteCanvas(id);

  res.json({ id });
});