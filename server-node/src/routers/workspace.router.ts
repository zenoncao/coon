/**
 * 工作空间路由模块
 *
 * 提供文件系统操作的 API 端点：
 * - POST /api/update_file - 更新文件
 * - POST /api/create_file - 创建文件
 * - POST /api/delete_file - 删除文件
 * - POST /api/rename_file - 重命名文件
 * - POST /api/read_file - 读取文件
 * - GET /api/list_files_in_dir - 列出目录文件
 * - POST /api/open_folder_in_explorer - 在资源管理器打开
 * - GET /api/browse_filesystem - 浏览文件系统
 * - GET /api/get_media_files - 获取媒体文件
 * - GET /api/get_file_thumbnail - 获取文件缩略图
 * - GET /api/serve_file - 提供文件服务
 * - GET /api/get_file_info - 获取文件信息
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as platform from 'os';
import { exec } from 'child_process';
import { USER_DATA_DIR } from '../services/config.service';

export const router = Router();

// 工作空间根目录
const WORKSPACE_ROOT = path.join(USER_DATA_DIR, 'workspace');

/**
 * 更新文件内容
 */
router.post('/update_file', async (req: Request, res: Response) => {
  try {
    const { path: filePath, content } = req.body;
    const fullPath = path.join(WORKSPACE_ROOT, filePath);

    fs.writeFileSync(fullPath, content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.json({ error: String(error), path: req.body.path });
  }
});

/**
 * 创建新文件
 */
router.post('/create_file', async (req: Request, res: Response) => {
  const { rel_dir } = req.body;
  const filePath = path.join(WORKSPACE_ROOT, rel_dir, 'Untitled.md');

  // 拆分路径
  const dirName = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const ext = path.extname(baseName);
  const name = path.basename(baseName, ext);

  let candidatePath = filePath;
  let counter = 1;

  while (fs.existsSync(candidatePath)) {
    const newBase = `${name} ${counter}${ext}`;
    candidatePath = path.join(dirName, newBase);
    counter++;
  }

  console.log('创建文件:', candidatePath);

  const candidateDir = path.dirname(candidatePath);
  if (!fs.existsSync(candidateDir)) {
    fs.mkdirSync(candidateDir, { recursive: true });
  }

  fs.writeFileSync(candidatePath, '', 'utf-8');

  res.json({ path: path.relative(WORKSPACE_ROOT, candidatePath) });
});

/**
 * 删除文件
 */
router.post('/delete_file', async (req: Request, res: Response) => {
  const { path: filePath } = req.body;

  fs.unlinkSync(filePath);

  res.json({ success: true });
});

/**
 * 重命名文件
 */
router.post('/rename_file', async (req: Request, res: Response) => {
  try {
    const { old_path, new_title } = req.body;
    const fullOldPath = path.join(WORKSPACE_ROOT, old_path);

    if (fs.existsSync(fullOldPath)) {
      const newPath = path.join(path.dirname(fullOldPath), new_title);
      fs.renameSync(fullOldPath, newPath);
      res.json({ success: true, path: newPath });
    } else {
      res.json({ error: `文件 ${old_path} 不存在`, path: old_path });
    }
  } catch (error) {
    console.error('重命名文件时出错:', error);
    res.json({ error: String(error) });
  }
});

/**
 * 读取文件内容
 */
router.post('/read_file', async (req: Request, res: Response) => {
  try {
    const { path: filePath } = req.body;
    const fullPath = path.join(WORKSPACE_ROOT, filePath);

    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      res.json({ content });
    } else {
      res.json({ error: `文件 ${filePath} 不存在`, path: filePath });
    }
  } catch (error) {
    res.json({ error: String(error), path: req.body.path });
  }
});

/**
 * 列出目录中的文件
 */
router.get('/list_files_in_dir', async (req: Request, res: Response) => {
  try {
    const relPath = req.query.rel_path as string || '';
    const fullPath = path.join(WORKSPACE_ROOT, relPath);

    const files = fs.readdirSync(fullPath);
    const fileNodes = files.map(file => {
      const filePath = path.join(fullPath, file);
      return {
        name: file,
        is_dir: fs.statSync(filePath).isDirectory(),
        rel_path: path.join(relPath, file),
      };
    });

    // 按类型和名称排序
    fileNodes.sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;
      return a.name.localeCompare(b.name);
    });

    res.json(fileNodes);
  } catch (error) {
    res.json([]);
  }
});

/**
 * 在系统文件浏览器中打开文件夹
 */
router.post('/open_folder_in_explorer', async (req: Request, res: Response) => {
  try {
    const { path: folderPath } = req.body;

    if (!folderPath) {
      res.status(400).json({ error: '缺少文件夹路径' });
      return;
    }

    if (!fs.existsSync(folderPath)) {
      res.status(404).json({ error: '文件夹不存在' });
      return;
    }

    if (!fs.statSync(folderPath).isDirectory()) {
      res.status(400).json({ error: '路径不是目录' });
      return;
    }

    const system = platform.platform();

    if (system === 'Windows') {
      exec(`explorer "${folderPath}"`);
    } else if (system === 'Darwin') {
      exec(`open "${folderPath}"`);
    } else if (system === 'Linux') {
      exec(`xdg-open "${folderPath}"`);
    } else {
      res.status(500).json({ error: `不支持的操作系统: ${system}` });
      return;
    }

    res.json({ success: true, message: '已在系统浏览器中打开文件夹' });
  } catch (error) {
    console.error('打开文件夹时出错:', error);
    res.status(500).json({ error: `打开文件夹失败: ${error}` });
  }
});

/**
 * 获取文件类型
 */
function getFileType(filePath: string): string {
  if (fs.statSync(filePath).isDirectory()) {
    return 'folder';
  }

  const ext = path.extname(filePath).toLowerCase();

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg', '.ico'];
  const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp'];
  const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'];
  const documentExtensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.pages'];
  const archiveExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'];
  const codeExtensions = ['.py', '.js', '.html', '.css', '.java', '.cpp', '.c', '.php', '.rb', '.go', '.rs'];

  if (imageExtensions.includes(ext)) return 'image';
  if (videoExtensions.includes(ext)) return 'video';
  if (audioExtensions.includes(ext)) return 'audio';
  if (documentExtensions.includes(ext)) return 'document';
  if (archiveExtensions.includes(ext)) return 'archive';
  if (codeExtensions.includes(ext)) return 'code';
  return 'file';
}

/**
 * 浏览文件系统
 */
router.get('/browse_filesystem', async (req: Request, res: Response) => {
  try {
    let browsePath = req.query.path as string || '';

    // 如果路径为空，从用户家目录开始
    if (!browsePath) {
      browsePath = platform.homedir();
    }

    if (!fs.existsSync(browsePath)) {
      res.status(404).json({ error: '路径不存在' });
      return;
    }

    if (!fs.statSync(browsePath).isDirectory()) {
      res.status(400).json({ error: '路径不是目录' });
      return;
    }

    const items: any[] = [];

    try {
      const files = fs.readdirSync(browsePath);

      for (const file of files) {
        // 跳过隐藏文件
        if (file.startsWith('.')) continue;

        try {
          const itemPath = path.join(browsePath, file);
          const stat = fs.statSync(itemPath);
          const isDir = stat.isDirectory();
          const fileType = getFileType(itemPath);

          items.push({
            name: file,
            path: itemPath,
            type: fileType,
            size: isDir ? null : stat.size,
            mtime: stat.mtime.getTime(),
            is_directory: isDir,
            is_media: fileType === 'image' || fileType === 'video',
            has_thumbnail: fileType === 'image' || fileType === 'video',
          });
        } catch {
          // 跳过无法访问的文件
          continue;
        }
      }
    } catch (error) {
      res.status(403).json({ error: '权限被拒绝' });
      return;
    }

    // 排序：文件夹在前，然后按名称排序
    items.sort((a, b) => {
      if (a.is_directory && !b.is_directory) return -1;
      if (!a.is_directory && b.is_directory) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    res.json({
      current_path: browsePath,
      parent_path: browsePath !== path.dirname(browsePath) ? path.dirname(browsePath) : null,
      items,
    });
  } catch (error) {
    console.error('浏览文件系统时出错:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 获取媒体文件
 */
router.get('/get_media_files', async (req: Request, res: Response) => {
  try {
    const mediaPath = req.query.path as string;

    if (!mediaPath || !fs.existsSync(mediaPath) || !fs.statSync(mediaPath).isDirectory()) {
      res.status(400).json({ error: '无效的目录路径' });
      return;
    }

    const mediaFiles: any[] = [];

    try {
      const files = fs.readdirSync(mediaPath);

      for (const file of files) {
        const filePath = path.join(mediaPath, file);

        if (fs.statSync(filePath).isFile()) {
          const fileType = getFileType(filePath);

          if (fileType === 'image' || fileType === 'video') {
            const stat = fs.statSync(filePath);

            mediaFiles.push({
              name: file,
              path: filePath,
              type: fileType,
              size: stat.size,
              mtime: stat.mtime.getTime(),
            });
          }
        }
      }
    } catch (error) {
      res.status(403).json({ error: '权限被拒绝' });
      return;
    }

    // 按修改时间排序
    mediaFiles.sort((a, b) => b.mtime - a.mtime);

    res.json(mediaFiles);
  } catch (error) {
    console.error('获取媒体文件时出错:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 获取文件缩略图信息
 */
router.get('/get_file_thumbnail', async (req: Request, res: Response) => {
  try {
    const filePath = req.query.file_path as string;

    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: '文件不存在' });
      return;
    }

    const fileType = getFileType(filePath);

    res.json({
      path: filePath,
      type: fileType,
      exists: true,
      can_preview: fileType === 'image' || fileType === 'video',
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 提供文件内容服务
 */
router.get('/serve_file', async (req: Request, res: Response) => {
  try {
    const filePath = req.query.file_path as string;

    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: '文件不存在' });
      return;
    }

    if (!fs.statSync(filePath).isFile()) {
      res.status(400).json({ error: '路径不是文件' });
      return;
    }

    const fileType = getFileType(filePath);
    if (fileType !== 'image' && fileType !== 'video') {
      res.status(400).json({ error: '文件类型不支持预览' });
      return;
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('提供文件服务时出错:', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * 获取文件详细信息
 */
router.get('/get_file_info', async (req: Request, res: Response) => {
  try {
    const filePath = req.query.file_path as string;

    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: '文件不存在' });
      return;
    }

    const stat = fs.statSync(filePath);
    const fileType = getFileType(filePath);

    res.json({
      name: path.basename(filePath),
      path: filePath,
      type: fileType,
      size: stat.size,
      mtime: stat.mtime.getTime(),
      ctime: stat.ctime.getTime(),
      is_directory: stat.isDirectory(),
      is_media: fileType === 'image' || fileType === 'video',
    });
  } catch (error) {
    console.error('获取文件信息时出错:', error);
    res.status(500).json({ error: String(error) });
  }
});