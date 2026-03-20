/**
 * Node.js 后端服务入口
 *
 * 该模块是应用程序的入口点，负责：
 * - 创建 HTTP 服务器
 * - 配置 Socket.IO
 * - 初始化服务
 * - 启动服务器
 */

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import * as path from 'path';
import * as fs from 'fs';
import { createApp } from './app';
import { configService } from './services/config.service';
import { toolService } from './services/tool.service';
import {
  initWebSocketService,
  addConnection,
  removeConnection,
  broadcastInitDone,
} from './services/websocket.service';
import { DEFAULT_PORT } from './common';

// 获取 React 构建目录
const rootDir = path.dirname(__dirname);
const reactBuildDir = process.env.UI_DIST_DIR || path.join(rootDir, 'react', 'dist');

/**
 * 初始化服务
 */
async function initialize(): Promise<void> {
  console.log('正在初始化 config_service');
  await configService.initialize();

  console.log('正在初始化 tool_service');
  await toolService.initialize();

  console.log('正在广播 init_done');
  await broadcastInitDone();
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  // 设置环境变量 - 绕过 localhost 请求的代理
  const bypassHosts = new Set(['127.0.0.1', 'localhost', '::1']);
  const currentNoProxy = new Set([
    ...(process.env.no_proxy || '').split(','),
    ...(process.env.NO_PROXY || '').split(','),
  ]);
  const mergedNoProxy = [...bypassHosts, ...currentNoProxy].filter(h => h).join(',');
  process.env.no_proxy = process.env.NO_PROXY = mergedNoProxy;

  // 获取端口
  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);

  // 创建 Express 应用
  console.log('正在创建 Express 应用');
  const app = createApp(reactBuildDir);

  // 创建 HTTP 服务器
  const httpServer = createServer(app);

  // 配置 Socket.IO
  console.log('正在配置 Socket.IO');
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  // 初始化 WebSocket 服务
  initWebSocketService(io);

  // 处理 Socket.IO 连接
  io.on('connection', (socket) => {
    console.log(`客户端 ${socket.id} 已连接`);

    // 添加连接
    addConnection(socket.id, socket.handshake.auth || {});

    // 发送连接成功消息
    socket.emit('connected', { status: 'connected' });

    // 处理断开连接
    socket.on('disconnect', () => {
      console.log(`客户端 ${socket.id} 已断开连接`);
      removeConnection(socket.id);
    });

    // 处理心跳
    socket.on('ping', (data) => {
      socket.emit('pong', data);
    });
  });

  // 启动服务器
  httpServer.listen(port, '127.0.0.1', async () => {
    console.log(`🌟 服务器启动成功，UI_DIST_DIR: ${process.env.UI_DIST_DIR}`);
    console.log(`🚀 服务器运行在 http://127.0.0.1:${port}`);

    // 初始化服务
    await initialize();
  });
}

// 启动应用
main().catch((error) => {
  console.error('启动服务器时出错:', error);
  process.exit(1);
});