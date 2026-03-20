/**
 * Express 应用配置模块
 *
 * 该模块负责配置 Express 应用，包括：
 * - 中间件配置
 * - 路由注册
 * - 静态文件服务
 * - 错误处理
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';

// 导入路由
import {
  configRouter,
  settingsRouter,
  canvasRouter,
  workspaceRouter,
  chatRouter,
  imageRouter,
  rootRouter,
} from '../routers';

/**
 * 创建并配置 Express 应用
 *
 * @param reactBuildDir - React 构建目录路径
 * @returns 配置好的 Express 应用实例
 */
export function createApp(reactBuildDir: string): Express {
  const app = express();

  // 配置 CORS
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // 配置 JSON 解析
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 注册路由 - 注意顺序很重要
  // 设置路由的 prefix 需要在注册时处理
  app.use('/api/config', configRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/canvas', canvasRouter);
  app.use('/api', workspaceRouter);
  app.use('/api', chatRouter);
  app.use('/api', imageRouter);
  app.use('/api', rootRouter);

  // 静态文件服务 - 提供上传的文件
  const assetsDir = path.join(reactBuildDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    app.use('/assets', express.static(assetsDir, {
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      },
    }));
  }

  // 提供 React 应用
  if (fs.existsSync(reactBuildDir)) {
    app.get('/', (req: Request, res: Response) => {
      const indexPath = path.join(reactBuildDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      } else {
        res.status(404).send('Index file not found');
      }
    });
  }

  // 错误处理中间件
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('服务器错误:', err);
    res.status(500).json({
      error: '服务器内部错误',
      message: err.message,
    });
  });

  return app;
}