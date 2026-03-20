# Jaaz 项目概述

## 项目简介

Jaaz 是一个开源的 AI 设计工具，作为 Canva 的替代品，专注于隐私保护和本地化使用。它是全球首个开源的多模态画布创意智能体，支持图像生成、视频生成、无限画布和多智能体系统。

**项目定位**：本地优先、隐私安全的 AI 创意设计工具

**官方网站**：https://jaaz.app

## 核心特性

### 🎬 一键图像与视频生成
- 支持单一提示词快速生成完整图像或视频
- 集成多种主流模型：GPT-4o、Midjourney、VEO3、Kling、Seedance 等
- 自动优化提示词，支持多轮迭代优化

### 🧙 魔法画布与魔法视频
- 无需编写提示词，像搭积木一样创作
- 简单草图绘制和自由组合，AI 即时理解并生成
- 支持在视频上描述步骤，AI 自动跟随生成

### 🖼️ 无限画布与可视化故事板
- 无限画布规划场景布局
- 可视化管理媒体资源
- 支持实时协作

### 🤖 智能多智能体系统
- 聊天式交互，支持插入对象、转换风格、控制逻辑
- 兼容本地模型 (ComfyUI) 和云端模型
- 多角色一致性保持

### ⚙️ 灵活部署与本地资源
- 完全离线或混合部署 (Ollama + APIs)
- 内置媒体和提示词库
- 跨平台支持：Windows 和 macOS

### 🔐 隐私与安全
- 本地优先，数据不离开设备
- 开源透明，无追踪
- 商业安全，用户拥有数据所有权

## 技术栈概览

### 前端技术栈
| 技术 | 用途 |
|------|------|
| React 18 | 前端框架 |
| TypeScript | 类型安全 |
| TanStack Router | 路由管理 |
| TanStack Query | 数据请求和缓存 |
| Excalidraw | 画布组件 |
| Tailwind CSS | 样式框架 |
| Shadcn/UI | UI 组件库 |
| Socket.IO Client | WebSocket 通信 |

### 后端技术栈
| 技术 | 用途 |
|------|------|
| Python 3.12+ | 后端语言 |
| FastAPI | Web 框架 |
| Socket.IO (python-socketio) | WebSocket 服务 |
| LangGraph | 多智能体框架 |
| LangChain | LLM 集成 |
| SQLite (aiosqlite) | 数据存储 |
| PyInstaller | 打包可执行文件 |

### 桌面应用技术栈
| 技术 | 用途 |
|------|------|
| Electron 35 | 桌面应用框架 |
| electron-builder | 应用打包 |
| electron-updater | 自动更新 |

## 项目结构目录

```
jaaz/
├── electron/                 # Electron 主进程模块
│   ├── main.js              # 应用入口，窗口管理
│   ├── preload.js           # 预加载脚本，IPC 桥接
│   ├── ipcHandlers.js       # IPC 处理器
│   ├── comfyUIInstaller.js  # ComfyUI 安装管理
│   ├── comfyUIManager.js    # ComfyUI 进程管理
│   └── settingsService.js   # 设置服务
│
├── react/                    # React 前端模块
│   ├── src/
│   │   ├── App.tsx          # 应用入口组件
│   │   ├── components/      # UI 组件
│   │   │   ├── canvas/      # 画布组件
│   │   │   ├── chat/        # 聊天组件
│   │   │   ├── agent_studio/# 智能体工作室
│   │   │   ├── auth/        # 认证组件
│   │   │   └── settings/    # 设置组件
│   │   ├── contexts/        # React Context 状态管理
│   │   ├── api/             # API 调用模块
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── types/           # TypeScript 类型定义
│   │   └── assets/          # 静态资源
│   └── package.json
│
├── server/                   # Python 后端模块
│   ├── main.py              # FastAPI 服务入口
│   ├── routers/             # API 路由
│   │   ├── chat_router.py   # 聊天 API
│   │   ├── canvas.py        # 画布 API
│   │   ├── config_router.py # 配置 API
│   │   └── websocket_router.py # WebSocket 路由
│   ├── services/            # 业务服务
│   │   ├── langgraph_service/ # LangGraph 多智能体服务
│   │   ├── tool_service.py  # 工具服务
│   │   ├── chat_service.py  # 聊天服务
│   │   ├── db_service.py    # 数据库服务
│   │   ├── config_service.py # 配置服务
│   │   └── websocket_service.py # WebSocket 服务
│   ├── tools/               # 图像/视频生成工具
│   │   ├── image_providers/ # 图像生成 Provider
│   │   ├── video_providers/ # 视频生成 Provider
│   │   └── video_generation/ # 视频生成核心
│   └── models/              # 数据模型
│
├── assets/                   # 应用资源
│   └── icons/               # 应用图标
│
├── scripts/                  # 构建脚本
├── package.json             # 项目配置
├── pyproject.toml           # Python 项目配置
└── README.md                # 项目说明
```

## 开发环境配置

### 前置要求
- Node.js 18+
- Python 3.12+
- pip 或 uv (Python 包管理器)

### 开发模式启动

```bash
# 克隆项目
git clone https://github.com/11cafe/jaaz.git
cd jaaz

# 安装前端依赖
cd react
npm install --force
npm run dev

# 另开终端，启动后端服务
cd server
pip install -r requirements.txt
python main.py

# 另开终端，启动 Electron (可选)
cd ..
npm run dev:electron
```

### 生产构建

```bash
# 构建前端
cd react && npm run build

# 构建桌面应用
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

## 相关文档

- [架构设计](./ARCHITECTURE.md)
- [Electron 主进程模块](./ELECTRON_MODULE.md)
- [React 前端模块](./REACT_FRONTEND.md)
- [Python 后端模块](./PYTHON_BACKEND.md)
- [AI 智能体系统](./AI_AGENT_SYSTEM.md)
- [图像/视频生成系统](./IMAGE_VIDEO_GENERATION.md)
- [API 参考](./API_REFERENCE.md)