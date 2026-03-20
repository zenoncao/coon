/**
 * 流任务服务模块
 *
 * 该模块负责管理异步流任务，包括：
 * - 任务注册和管理
 * - 任务取消支持
 * - 任务状态查询
 */

// 存储活跃的流任务，以 session_id 为键
const streamTasks: Map<string, { cancel: () => void; done: boolean }> = new Map();

/**
 * 添加流任务
 *
 * @param sessionId - 会话 ID
 * @param task - 任务对象，包含取消方法和完成状态
 */
export function addStreamTask(sessionId: string, task: { cancel: () => void; done: boolean }): void {
  streamTasks.set(sessionId, task);
}

/**
 * 移除流任务
 *
 * @param sessionId - 会话 ID
 */
export function removeStreamTask(sessionId: string): void {
  streamTasks.delete(sessionId);
}

/**
 * 获取流任务
 *
 * @param sessionId - 会话 ID
 * @returns 任务对象，如果不存在则返回 undefined
 */
export function getStreamTask(sessionId: string): { cancel: () => void; done: boolean } | undefined {
  return streamTasks.get(sessionId);
}

/**
 * 列出所有流任务
 *
 * @returns 所有 session_id 列表
 */
export function listStreamTasks(): string[] {
  return Array.from(streamTasks.keys());
}