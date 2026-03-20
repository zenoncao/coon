/**
 * 设置路由模块
 *
 * 提供设置相关的 API 端点：
 * - GET /api/settings/exists - 检查设置文件是否存在
 * - GET /api/settings - 获取所有设置
 * - POST /api/settings - 更新设置
 * - GET /api/settings/proxy/status - 获取代理状态
 * - GET /api/settings/proxy - 获取代理设置
 * - POST /api/settings/proxy - 更新代理设置
 * - POST /api/settings/comfyui/create_workflow - 创建 ComfyUI 工作流
 * - GET /api/settings/comfyui/list_workflows - 列出工作流
 * - DELETE /api/settings/comfyui/delete_workflow/:id - 删除工作流
 * - POST /api/settings/comfyui/proxy - ComfyUI 代理请求
 * - GET /api/settings/knowledge/enabled - 获取启用的知识库
 * - GET /api/settings/my_assets_dir_path - 获取资源目录路径
 */

import { Router, Request, Response } from 'express';
import { settingsService } from '../services/settings.service';
import { dbService } from '../services/db.service';
import { toolService } from '../services/tool.service';
import { FILES_DIR } from '../services/config.service';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export const router = Router();

/**
 * 检查设置文件是否存在
 */
router.get('/exists', async (req: Request, res: Response) => {
  res.json({ exists: await settingsService.existsSettings() });
});

/**
 * 获取所有设置配置
 */
router.get('/', async (req: Request, res: Response) => {
  res.json(settingsService.getSettings());
});

/**
 * 更新设置配置
 */
router.post('/', async (req: Request, res: Response) => {
  const data = req.body;
  const result = await settingsService.updateSettings(data);
  res.json(result);
});

/**
 * 获取代理配置状态
 */
router.get('/proxy/status', async (req: Request, res: Response) => {
  const settings = settingsService.getRawSettings();
  const proxySetting = settings.proxy;

  if (proxySetting === 'no_proxy') {
    res.json({
      enable: false,
      configured: true,
      message: '代理已禁用',
    });
  } else if (proxySetting === 'system') {
    res.json({
      enable: true,
      configured: true,
      message: '使用系统代理',
    });
  } else if (proxySetting.startsWith('http://') || proxySetting.startsWith('https://') ||
             proxySetting.startsWith('socks4://') || proxySetting.startsWith('socks5://')) {
    res.json({
      enable: true,
      configured: true,
      message: '使用自定义代理',
    });
  } else {
    res.json({
      enable: true,
      configured: false,
      message: '代理配置无效',
    });
  }
});

/**
 * 获取代理设置
 */
router.get('/proxy', async (req: Request, res: Response) => {
  const proxyConfig = settingsService.getProxyConfig();
  res.json({ proxy: proxyConfig });
});

/**
 * 更新代理设置
 */
router.post('/proxy', async (req: Request, res: Response) => {
  const { proxy } = req.body;

  if (!proxy || typeof proxy !== 'string') {
    res.status(400).json({ error: '无效的代理配置' });
    return;
  }

  // 验证代理值
  const validValues = ['no_proxy', 'system'];
  const isValidUrl = proxy.startsWith('http://') || proxy.startsWith('https://') ||
                     proxy.startsWith('socks4://') || proxy.startsWith('socks5://');

  if (!validValues.includes(proxy) && !isValidUrl) {
    res.status(400).json({ error: '无效的代理值，必须是 no_proxy、system 或有效的代理 URL' });
    return;
  }

  const result = await settingsService.updateSettings({ proxy });
  res.json(result);
});

/**
 * 创建 ComfyUI 工作流
 */
router.post('/comfyui/create_workflow', async (req: Request, res: Response) => {
  const { name, api_json, description, inputs, outputs } = req.body;

  if (!name || !api_json || !description || !inputs) {
    res.status(400).json({ error: '缺少必需字段' });
    return;
  }

  try {
    const workflowName = name.replace(/ /g, '_');
    const apiJsonStr = typeof api_json === 'string' ? api_json : JSON.stringify(api_json);
    const inputsStr = typeof inputs === 'string' ? inputs : JSON.stringify(inputs);
    const outputsStr = outputs ? (typeof outputs === 'string' ? outputs : JSON.stringify(outputs)) : null;

    dbService.createComfyWorkflow(workflowName, apiJsonStr, description, inputsStr, outputsStr || undefined);
    await toolService.initialize();

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: `创建工作流失败: ${error}` });
  }
});

/**
 * 列出所有 ComfyUI 工作流
 */
router.get('/comfyui/list_workflows', async (req: Request, res: Response) => {
  const workflows = dbService.listComfyWorkflows();
  res.json(workflows);
});

/**
 * 删除 ComfyUI 工作流
 */
router.delete('/comfyui/delete_workflow/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const result = dbService.deleteComfyWorkflow(id);
  await toolService.initialize();
  res.json(result);
});

/**
 * ComfyUI 代理请求
 */
router.post('/comfyui/proxy', async (req: Request, res: Response) => {
  const { url, path: requestPath } = req.body;

  if (!url || !requestPath) {
    res.status(400).json({ error: '缺少 url 或 path 参数' });
    return;
  }

  try {
    const fullUrl = `${url}${requestPath}`;
    const response = await axios.get(fullUrl);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: `代理请求失败: ${error}` });
  }
});

/**
 * 获取启用的知识库列表
 */
router.get('/knowledge/enabled', async (req: Request, res: Response) => {
  try {
    // 简化实现 - 直接返回空列表
    // 完整实现需要集成知识库服务
    res.json({
      success: true,
      data: [],
      count: 0,
    });
  } catch (error) {
    res.json({
      success: false,
      error: String(error),
      data: [],
    });
  }
});

/**
 * 获取资源目录路径
 */
router.get('/my_assets_dir_path', async (req: Request, res: Response) => {
  try {
    // 确保目录存在
    if (!fs.existsSync(FILES_DIR)) {
      fs.mkdirSync(FILES_DIR, { recursive: true });
    }

    res.json({
      success: true,
      path: FILES_DIR,
      message: '资源目录路径获取成功',
    });
  } catch (error) {
    res.json({
      success: false,
      error: String(error),
      path: '',
    });
  }
});