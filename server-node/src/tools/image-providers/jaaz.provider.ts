/**
 * Jaaz 图像生成提供者
 *
 * 实现 Jaaz 云服务的图像生成 API
 */

import { ImageProviderBase, ImageGenerationResult } from './image-base.provider';
import { configService, FILES_DIR } from '../../services/config.service';
import { HttpClient } from '../../utils/http-client';
import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import axios from 'axios';
import sharp from 'sharp';

/**
 * Jaaz 图像生成提供者
 */
export class JaazImageProvider extends ImageProviderBase {
  /**
   * 构建请求 URL
   */
  private buildUrl(): string {
    const config = configService.getConfig().jaaz || {};
    let apiUrl = (config.url || '').replace(/\/$/, '');

    if (!apiUrl) {
      throw new Error('Jaaz API URL 未配置');
    }

    if (apiUrl.endsWith('/api/v1')) {
      return `${apiUrl}/image/generations`;
    } else {
      return `${apiUrl}/api/v1/image/generations`;
    }
  }

  /**
   * 构建请求头
   */
  private buildHeaders(): Record<string, string> {
    const config = configService.getConfig().jaaz || {};
    const apiToken = config.api_key || '';

    if (!apiToken) {
      throw new Error('Jaaz API token 未配置');
    }

    return {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 生成图像 ID
   */
  private generateImageId(): string {
    return nanoid(10);
  }

  /**
   * 下载并保存图像
   */
  private async downloadAndSaveImage(
    url: string,
    metadata?: Record<string, any>
  ): Promise<{ mimeType: string; width: number; height: number; extension: string }> {
    const imageId = this.generateImageId();
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });

    const buffer = Buffer.from(response.data);

    // 使用 sharp 获取图像信息
    const image = sharp(buffer);
    const meta = await image.metadata();

    let extension = 'png';
    let mimeType = 'image/png';

    // 根据原始格式确定扩展名
    if (meta.format) {
      const formatMap: Record<string, { ext: string; mime: string }> = {
        jpeg: { ext: 'jpg', mime: 'image/jpeg' },
        jpg: { ext: 'jpg', mime: 'image/jpeg' },
        png: { ext: 'png', mime: 'image/png' },
        webp: { ext: 'webp', mime: 'image/webp' },
        gif: { ext: 'gif', mime: 'image/gif' },
      };
      const formatInfo = formatMap[meta.format];
      if (formatInfo) {
        extension = formatInfo.ext;
        mimeType = formatInfo.mime;
      }
    }

    // 保存图像
    const savePath = path.join(FILES_DIR, `${imageId}.${extension}`);
    fs.writeFileSync(savePath, buffer);

    console.log(`图像已保存: ${savePath}`);

    return {
      mimeType,
      width: meta.width || 0,
      height: meta.height || 0,
      extension,
    };
  }

  /**
   * 生成图像
   */
  async generate(
    prompt: string,
    model: string,
    aspectRatio: string = '1:1',
    inputImages?: string[],
    metadata?: Record<string, any>
  ): Promise<ImageGenerationResult> {
    const url = this.buildUrl();
    const headers = this.buildHeaders();

    // 构建请求数据
    const data: Record<string, any> = {
      prompt,
      model,
      aspect_ratio: aspectRatio,
    };

    // 添加输入图像
    if (inputImages && inputImages.length > 0) {
      data.input_image = inputImages[0];
      if (inputImages.length > 1) {
        console.warn('警告：Jaaz 格式只支持单图像输入。使用第一张图像。');
      }
    }

    console.log(`Jaaz API 请求: ${url}, 模型: ${model}`);

    try {
      const response = await HttpClient.create().post(url, data, { headers });
      const result = response.data;

      if (result.data && result.data.length > 0) {
        const imageData = result.data[0];
        if (imageData.url) {
          const { mimeType, width, height, extension } = await this.downloadAndSaveImage(
            imageData.url,
            metadata
          );

          const filename = `${this.generateImageId()}.${extension}`;

          return {
            mimeType,
            width,
            height,
            filename,
          };
        }
      }

      throw new Error('Jaaz 图像生成失败：响应中没有有效的图像数据');
    } catch (error: any) {
      console.error('Jaaz 图像生成错误:', error.message);
      throw error;
    }
  }
}