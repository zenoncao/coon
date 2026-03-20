/**
 * WebSocket 服务模块
 *
 * 该模块负责管理 WebSocket 通信，包括：
 * - 消息广播
 * - 会话更新通知
 * - 初始化完成通知
 */

import { Server as SocketIOServer, Socket } from 'socket.io';

// Socket.IO 服务器实例
let io: SocketIOServer | null = null;

// 活跃的连接
const activeConnections: Map<string, any> = new Map();

/**
 * 初始化 WebSocket 服务
 *
 * @param socketIo - Socket.IO 服务器实例
 */
export function initWebSocketService(socketIo: SocketIOServer): void {
  io = socketIo;
}

/**
 * 添加连接
 *
 * @param socketId - Socket ID
 * @param userInfo - 用户信息
 */
export function addConnection(socketId: string, userInfo?: any): void {
  activeConnections.set(socketId, userInfo || {});
  console.log(`新连接已添加: ${socketId}, 总连接数: ${activeConnections.size}`);
}

/**
 * 移除连接
 *
 * @param socketId - Socket ID
 */
export function removeConnection(socketId: string): void {
  activeConnections.delete(socketId);
  console.log(`连接已移除: ${socketId}, 总连接数: ${activeConnections.size}`);
}

/**
 * 获取所有 Socket ID
 *
 * @returns 所有 Socket ID 列表
 */
export function getAllSocketIds(): string[] {
  return Array.from(activeConnections.keys());
}

/**
 * 获取连接数
 *
 * @returns 当前连接数
 */
export function getConnectionCount(): number {
  return activeConnections.size;
}

/**
 * 广播会话更新
 *
 * @param sessionId - 会话 ID
 * @param canvasId - 画布 ID
 * @param event - 事件数据
 */
export async function broadcastSessionUpdate(
  sessionId: string,
  canvasId: string | null,
  event: Record<string, any>
): Promise<void> {
  const socketIds = getAllSocketIds();
  if (socketIds.length > 0 && io) {
    try {
      for (const socketId of socketIds) {
        io.to(socketId).emit('session_update', {
          canvas_id: canvasId,
          session_id: sessionId,
          ...event,
        });
      }
    } catch (error) {
      console.error(`广播会话更新失败 ${sessionId}:`, error);
    }
  }
}

/**
 * 发送消息到 WebSocket
 * 兼容旧代码
 *
 * @param sessionId - 会话 ID
 * @param event - 事件数据
 */
export async function sendToWebsocket(sessionId: string, event: Record<string, any>): Promise<void> {
  await broadcastSessionUpdate(sessionId, null, event);
}

/**
 * 广播初始化完成通知
 */
export async function broadcastInitDone(): Promise<void> {
  if (io) {
    try {
      io.emit('init_done', {
        type: 'init_done',
      });
      console.log('已向所有客户端广播 init_done');
    } catch (error) {
      console.error('广播 init_done 失败:', error);
    }
  }
}