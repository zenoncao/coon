# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供在本代码库中工作的指导。

## 项目概述

Jaaz 是一个开源的 AI 设计工具（Canva 替代品），具有多模态画布和多智能体 AI 系统。它支持无限画布、AI 驱动的图像/视频生成，以及对话驱动的智能体系统。

**架构**：三层桌面应用程序
- **Electron** (`/electron`)：桌面外壳、窗口管理、Node.js 后端进程启动
- **React** (`/react`)：前端 UI、画布（Excalidraw）、聊天界面
- **Node.js** (`/server-node`)：Express 后端、多智能体系统、Socket.IO 服务器

## 开发命令

### 环境要求
- Node.js 18+

### 开发模式运行

```bash
# 终端 1：React 前端（Vite 开发服务器，端口 5174）
cd react && npm install --force && npm run dev

# 终端 2：Node.js 后端（Express，端口 57988）
cd server-node && npm install && npm run dev

# 终端 3：Electron（可选，用于测试桌面外壳）
npm run dev:electron
```

或使用项目根目录的组合命令：
```bash
npm run dev  # 同时运行 React + Electron
```

### 生产构建

```bash
# 构建完整应用（React + server-node + Electron）
npm run build

# 或分步构建：
# 构建 React 前端
npm run build:react

# 构建 Node.js 后端
cd server-node && npm run build

# 构建 Electron 应用
npm run build:mac     # macOS (.dmg, .zip)
npm run build:win     # Windows (.exe 安装程序)
npm run build:linux   # Linux (AppImage, .deb)
```

### 测试

```bash
# 运行所有测试
npm test

# 运行一次测试
npm run test:run

# 监听模式
npm run test:watch
```

### 代码格式化

项目使用 Prettier 和 ESLint 进行代码格式化（配置在 `.prettierrc.json` 中）。

## 核心架构模式

### 通信流程

1. **Electron ↔ React**：通过 `preload.js` 桥接进行 IPC 通信
   - `window.electronAPI` 暴露的方法：`pick-image`、`pick-video`、`check-for-updates`、`install-comfyui`

2. **React ↔ Node.js**：HTTP REST + Socket.IO
   - REST API (`/api/*`)：配置、画布数据、聊天消息
   - Socket.IO (`/socket.io`)：实时更新、生成进度、智能体响应

3. **Node.js 服务初始化** (`server-node/src/index.ts`)：
   ```typescript
   // 顺序很重要：configService → toolService
   await configService.initialize();
   await toolService.initialize();
   ```

### 多智能体系统

位于 `server-node/src/services/`：
- **规划者智能体 (Planner Agent)**：分析用户意图，创建执行计划
- **创作者智能体 (Creator Agent)**：通过工具执行图像/视频生成
- **工具**：位于 `server-node/src/tools/`，支持 Midjourney、GPT-4o、VEO3、ComfyUI 等提供商

### 画布数据流

1. 用户编辑 → Excalidraw `onChange`（防抖 1 秒）
2. POST `/api/canvas/{id}` → SQLite 持久化
3. Socket.IO 广播 `session_update` 事件，用于 AI 生成的元素

### 端口配置

- React 开发：5174
- Node.js 后端：57988（如果被占用则自动回退）
- Electron 在生产环境加载 `react/dist/index.html`，在开发环境代理到 Vite 开发服务器

## 目录结构

```
jaaz/
├── electron/           # 主进程、IPC 处理器
├── react/
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/      # Excalidraw 包装器
│   │   │   ├── chat/        # 聊天 UI、消息处理
│   │   │   └── agent_studio/# 智能体配置
│   │   ├── api/             # REST API 包装器
│   │   ├── hooks/           # 自定义 React hooks
│   │   └── stores/          # Zustand 状态管理
└── server-node/             # Node.js 后端（Express）
    ├── src/
    │   ├── routers/         # Express 路由处理器
    │   ├── services/        # 业务逻辑、智能体系统
    │   ├── tools/           # 图像/视频生成提供商
    │   └── models/          # 数据模型
```

## 重要实现注意事项

- **Node.js 服务启动**：Electron 启动时会检查 `server-node/dist/index.js` 是否存在，请先运行 `npm run build:server-node` 构建后端
- **静态文件**：Node.js 后端提供 React 的 `dist/` 目录作为静态文件服务
- **进程启动**：Electron 在应用启动时生成 Node.js 作为子进程，并管理其生命周期

## 环境变量

生产构建使用以下变量（见 `.github/workflows/build.yml`）：
- `VITE_UMAMI_WEBSITE_ID`
- `VITE_PUBLIC_POSTHOG_KEY`
- `VITE_PUBLIC_POSTHOG_HOST`

## 测试配置

Vitest 配置在 `vitest.config.js` 中：
- 环境：Node.js
- 测试文件：`**/*.test.js`
- 池：forks（单 fork 模式用于隔离）
- 别名：`@/` 映射到 `./electron`
