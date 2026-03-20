/**
 * 图像画布工具模块
 *
 * 处理画布操作、锁定和通知
 */

import { dbService } from '../../services/db.service';
import { broadcastSessionUpdate, sendToWebsocket } from '../../services/websocket.service';
import { findNextBestElementPosition } from '../../utils/canvas';
import { FILES_DIR } from '../../services/config.service';
import { nanoid } from 'nanoid';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 生成文件 ID
 */
export function generateFileId(): string {
  return 'im_' + nanoid(8);
}

/**
 * 生成新图像元素
 */
async function generateNewImageElement(
  canvasId: string,
  fileId: string,
  imageData: { width: number; height: number },
  canvasData?: Record<string, any>
): Promise<Record<string, any>> {
  if (!canvasData) {
    const canvas = dbService.getCanvasData(canvasId);
    canvasData = canvas?.data || {};
  }

  const [newX, newY] = await findNextBestElementPosition(canvasData);

  return {
    type: 'image',
    id: fileId,
    x: newX,
    y: newY,
    width: imageData.width || 0,
    height: imageData.height || 0,
    angle: 0,
    fileId: fileId,
    strokeColor: '#000000',
    fillStyle: 'solid',
    strokeStyle: 'solid',
    boundElements: null,
    roundness: null,
    frameId: null,
    backgroundColor: 'transparent',
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
    groupIds: [],
    seed: Math.floor(Math.random() * 1000000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false,
    index: null,
    updated: 0,
    link: null,
    locked: false,
    status: 'saved',
    scale: [1, 1],
    crop: null,
  };
}

/**
 * 保存图像到画布
 */
export async function saveImageToCanvas(
  sessionId: string,
  canvasId: string,
  filename: string,
  mimeType: string,
  width: number,
  height: number
): Promise<string> {
  // 获取画布数据
  const canvas = dbService.getCanvasData(canvasId);
  const canvasData: Record<string, any> = canvas?.data || {};

  // 确保 elements 和 files 键存在
  if (!canvasData.elements) {
    canvasData.elements = [];
  }
  if (!canvasData.files) {
    canvasData.files = {};
  }

  const fileId = generateFileId();
  const url = `/api/file/${filename}`;

  const fileData: Record<string, any> = {
    mimeType: mimeType,
    id: fileId,
    dataURL: url,
    created: Date.now(),
  };

  const newImageElement = await generateNewImageElement(
    canvasId,
    fileId,
    { width, height },
    canvasData
  );

  // 更新画布数据
  canvasData.elements.push(newImageElement);
  canvasData.files[fileId] = fileData;

  const imageUrl = `/api/file/${filename}`;

  // 保存更新后的画布数据
  dbService.saveCanvasData(canvasId, JSON.stringify(canvasData));

  // 广播图像生成消息到前端
  await broadcastSessionUpdate(sessionId, canvasId, {
    type: 'image_generated',
    element: newImageElement,
    file: fileData,
    image_url: imageUrl,
  });

  return imageUrl;
}

/**
 * 发送图像生成开始通知
 */
export async function sendImageStartNotification(
  sessionId: string,
  message: string
): Promise<void> {
  await sendToWebsocket(sessionId, {
    type: 'image_generation_start',
    message,
  });
}

/**
 * 发送图像生成错误通知
 */
export async function sendImageErrorNotification(
  sessionId: string,
  errorMessage: string
): Promise<void> {
  await sendToWebsocket(sessionId, {
    type: 'error',
    error: errorMessage,
  });
}