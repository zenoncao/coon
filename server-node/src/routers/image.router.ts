/**
 * 图像路由模块
 *
 * 提供图像相关的 API 端点：
 * - POST /api/upload_image - 上传图片
 * - GET /api/file/:fileId - 获取文件
 * - POST /api/comfyui/object_info - 获取 ComfyUI 对象信息
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { FILES_DIR } from '../services/config.service';
import { DEFAULT_PORT } from '../common';
import { nanoid } from 'nanoid';

export const router = Router();

// 确保文件目录存在
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

// 配置 multer 用于文件上传
const upload = multer({ storage: multer.memoryStorage() });

/**
 * 生成文件 ID
 */
function generateFileId(): string {
  return 'im_' + nanoid(8);
}

/**
 * 上传图片
 */
router.post('/upload_image', upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file;
  const maxSizeMB = parseFloat(req.body.max_size_mb) || 3.0;

  console.log('上传图片:', file?.originalname);

  if (!file) {
    res.status(400).json({ error: '没有上传文件' });
    return;
  }

  const fileId = generateFileId();
  const filename = file.originalname || '';
  const originalSizeMB = file.size / (1024 * 1024);

  try {
    // 使用 sharp 处理图像
    const image = sharp(file.buffer);
    const metadata = await image.metadata();
    let width = metadata.width || 0;
    let height = metadata.height || 0;

    let extension = 'png';
    let savePath = path.join(FILES_DIR, `${fileId}.${extension}`);

    // 检查是否需要压缩
    if (originalSizeMB > maxSizeMB) {
      console.log(`图像大小 (${originalSizeMB.toFixed(2)}MB) 超过限制 (${maxSizeMB}MB)，正在压缩...`);

      // 压缩为 JPEG 格式
      extension = 'jpg';
      savePath = path.join(FILES_DIR, `${fileId}.${extension}`);

      const compressedBuffer = await image
        .jpeg({ quality: 95, mozjpeg: true })
        .toBuffer();

      // 如果还是太大，进一步降低质量
      let quality = 85;
      let finalBuffer = compressedBuffer;
      while (finalBuffer.length / (1024 * 1024) > maxSizeMB && quality > 10) {
        quality -= 10;
        finalBuffer = await sharp(file.buffer)
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
      }

      fs.writeFileSync(savePath, finalBuffer);

      // 获取压缩后的尺寸
      const compressedMeta = await sharp(finalBuffer).metadata();
      width = compressedMeta.width || width;
      height = compressedMeta.height || height;

      console.log(`压缩完成，从 ${originalSizeMB.toFixed(2)}MB 到 ${(finalBuffer.length / (1024 * 1024)).toFixed(2)}MB`);
    } else {
      // 根据原始格式保存
      const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
      };

      extension = mimeToExt[file.mimetype] || 'png';
      savePath = path.join(FILES_DIR, `${fileId}.${extension}`);

      fs.writeFileSync(savePath, file.buffer);
    }

    console.log('文件保存路径:', savePath);

    res.json({
      file_id: `${fileId}.${extension}`,
      url: `http://localhost:${DEFAULT_PORT}/api/file/${fileId}.${extension}`,
      width,
      height,
    });
  } catch (error) {
    console.error('处理图片时出错:', error);
    res.status(500).json({ error: `处理图片失败: ${error}` });
  }
});

/**
 * 获取文件
 */
router.get('/file/:fileId', async (req: Request, res: Response) => {
  const { fileId } = req.params;
  const filePath = path.join(FILES_DIR, fileId);

  console.log('获取文件:', filePath);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }

  res.sendFile(filePath);
});

/**
 * 获取 ComfyUI 对象信息
 */
router.post('/comfyui/object_info', async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    res.status(400).json({ error: 'URL 是必需的' });
    return;
  }

  try {
    const response = await axios.get(`${url}/api/object_info`, {
      timeout: 10000,
    });

    res.json(response.data);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error('ComfyUI 连接错误:', error.message);
      res.status(503).json({ error: 'ComfyUI 服务不可用，请确保 ComfyUI 正在运行' });
    } else {
      console.error('连接 ComfyUI 时出错:', error.message);
      res.status(500).json({ error: `连接 ComfyUI 失败: ${error.message}` });
    }
  }
});