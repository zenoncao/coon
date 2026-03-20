/**
 * 图像生成提供者基类
 *
 * 所有图像生成提供者都必须实现此接口
 */

export interface ImageGenerationResult {
  mimeType: string;
  width: number;
  height: number;
  filename: string;
}

export abstract class ImageProviderBase {
  /**
   * 生成图像
   *
   * @param prompt - 图像生成提示词
   * @param model - 模型名称
   * @param aspectRatio - 图像长宽比
   * @param inputImages - 可选的输入参考图像
   * @param metadata - 可选的元数据
   * @returns 生成结果
   */
  abstract generate(
    prompt: string,
    model: string,
    aspectRatio?: string,
    inputImages?: string[],
    metadata?: Record<string, any>
  ): Promise<ImageGenerationResult>;
}