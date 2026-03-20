/**
 * 配置路由模块
 *
 * 提供 Provider 配置相关的 API 端点：
 * - GET /api/config/exists - 检查配置文件是否存在
 * - GET /api/config - 获取应用配置
 * - POST /api/config - 更新应用配置
 */

import { Router, Request, Response } from 'express';
import { configService } from '../services/config.service';
import { toolService } from '../services/tool.service';

export const router = Router();

/**
 * 检查配置文件是否存在
 */
router.get('/exists', async (req: Request, res: Response) => {
  res.json({ exists: configService.existsConfig() });
});

/**
 * 获取应用配置
 */
router.get('/', async (req: Request, res: Response) => {
  res.json(configService.getConfig());
});

/**
 * 更新应用配置
 */
router.post('/', async (req: Request, res: Response) => {
  const data = req.body;
  const result = await configService.updateConfig(data);

  // 每次更新配置后，重新初始化工具
  await toolService.initialize();

  res.json(result);
});