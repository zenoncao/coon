/**
 * 图像生成核心模块
 *
 * 包含跨不同提供者进行图像生成的主要编排逻辑
 */

import { ImageProviderBase, ImageGenerationResult } from './image-providers/image-base.provider';
import { JaazImageProvider } from './image-providers/jaaz.provider';
import { FILES_DIR, DEFAULT_PORT } from '../../services/config.service';
import { saveImageToCanvas, generateFileId } from './utils/image-canvas-utils';

// 图像提供者注册表
const IMAGE_PROVIDERS: Record<string, ImageProviderBase> = {
  jaaz: new JaazImageProvider(),
  // 可以添加更多提供者
};

/**
 * 使用指定提供者生成图像
 *
 * @param canvasId - 画布 ID
 * @param sessionId - 会话 ID
 * @param provider - 提供者名称
 * @param model - 模型名称
 * @param prompt - 图像生成提示词
 * @param aspectRatio - 图像长宽比
 * @param inputImages - 可选的输入参考图像
 * @returns 生成结果消息
 */
export async function generateImageWithProvider(
  canvasId: string,
  sessionId: string,
  provider: string,
  model: string,
  prompt: string,
  aspectRatio: string = '1:1',
  inputImages?: string[]
): Promise<string> {
  const providerInstance = IMAGE_PROVIDERS[provider];

  if (!providerInstance) {
    throw new Error(`未知的提供者: ${provider}`);
  }

  // 准备元数据
  const metadata: Record<string, any> = {
    prompt,
    model,
    provider,
    aspect_ratio: aspectRatio,
    input_images: inputImages || [],
  };

  // 使用提供者生成图像
  const result = await providerInstance.generate(
    prompt,
    model,
    aspectRatio,
    inputImages,
    metadata
  );

  // 保存图像到画布
  const imageUrl = await saveImageToCanvas(
    sessionId,
    canvasId,
    result.filename,
    result.mimeType,
    result.width,
    result.height
  );

  return `图像生成成功 ![image_id: ${result.filename}](http://localhost:${DEFAULT_PORT}${imageUrl})`;
}