/**
 * 视频生成提供者基类
 *
 * 所有视频生成提供者都必须实现此接口
 */

export interface VideoGenerationResult {
  videoUrl: string;
  duration?: number;
  resolution?: string;
}

export abstract class VideoProviderBase {
  /**
   * 生成视频
   *
   * @param prompt - 视频生成提示词
   * @param model - 模型名称
   * @param resolution - 视频分辨率
   * @param duration - 视频时长（秒）
   * @param aspectRatio - 视频长宽比
   * @param inputImages - 可选的输入参考图像
   * @param cameraFixed - 是否保持相机固定
   * @returns 生成结果
   */
  abstract generate(
    prompt: string,
    model: string,
    resolution?: string,
    duration?: number,
    aspectRatio?: string,
    inputImages?: string[],
    cameraFixed?: boolean
  ): Promise<VideoGenerationResult>;
}

/**
 * 获取默认提供者
 */
export function getDefaultVideoProvider(modelInfoList?: { provider: string }[]): string {
  if (modelInfoList && modelInfoList.length > 0) {
    // 优先使用 Jaaz 提供者
    for (const modelInfo of modelInfoList) {
      if (modelInfo.provider === 'jaaz') {
        return 'jaaz';
      }
    }
    // 如果没有 Jaaz，使用第一个可用的
    return modelInfoList[0].provider || 'jaaz';
  }
  return 'jaaz';
}