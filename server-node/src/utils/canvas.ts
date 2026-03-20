/**
 * 画布工具模块
 *
 * 提供画布操作相关的工具函数
 */

/**
 * 找到下一个最佳元素位置
 *
 * @param canvasData - 画布数据
 * @returns 新元素的坐标 [x, y]
 */
export function findNextBestElementPosition(canvasData: Record<string, any>): [number, number] {
  const elements = canvasData.elements || [];

  if (elements.length === 0) {
    return [100, 100]; // 默认起始位置
  }

  // 找到最右侧和最下方的元素
  let maxX = 0;
  let maxY = 0;
  let minX = Infinity;
  let minY = Infinity;

  for (const element of elements) {
    if (!element.isDeleted) {
      const x = element.x || 0;
      const y = element.y || 0;
      const width = element.width || 100;
      const height = element.height || 100;

      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
    }
  }

  // 在最右侧放置新元素
  const newX = maxX + 50;
  const newY = minY;

  return [newX, newY];
}