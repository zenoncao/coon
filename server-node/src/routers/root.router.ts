/**
 * 根路由模块
 *
 * 提供根路径的 API 端点
 */

import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

export const router = Router();

/**
 * 健康检查端点
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});