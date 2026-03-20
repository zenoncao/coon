# Jaaz Node.js Server

这是 Jaaz 项目的 Node.js 后端服务，将原有的 Python FastAPI 后端转换为 Node.js/Express 版本。

## 技术栈

| 功能 | Python | Node.js 替代 |
|------|--------|-------------|
| Web 框架 | FastAPI | Express.js |
| WebSocket | python-socketio | Socket.IO |
| 数据库 | aiosqlite | better-sqlite3 |
| 配置格式 | TOML | TOML (smol-toml) |
| HTTP 客户端 | httpx/aiohttp | axios |
| 图像处理 | Pillow | sharp |
| 异步任务 | asyncio | 原生 Promise/async |

## 项目结构

```
server-node/
├── src/
│   ├── index.ts                    # 应用入口
│   ├── app.ts                      # Express 应用配置
│   ├── common.ts                   # 通用常量
│   ├── routers/                    # 路由模块
│   │   ├── config.router.ts        # 配置路由
│   │   ├── settings.router.ts      # 设置路由
│   │   ├── canvas.router.ts        # 画布路由
│   │   ├── workspace.router.ts     # 工作空间路由
│   │   ├── chat.router.ts          # 聊天路由
│   │   ├── image.router.ts         # 图像路由
│   │   └── root.router.ts          # 根路由
│   ├── services/                   # 核心服务
│   │   ├── config.service.ts       # 配置服务
│   │   ├── settings.service.ts     # 设置服务
│   │   ├── db.service.ts           # 数据库服务
│   │   ├── chat.service.ts         # 聊天服务
│   │   ├── magic.service.ts        # 魔法功能服务
│   │   ├── tool.service.ts         # 工具服务
│   │   ├── websocket.service.ts    # WebSocket 服务
│   │   ├── stream.service.ts       # 流任务管理
│   │   └── langgraph-service/      # AI Agent 多智能体服务
│   ├── tools/                      # 图像/视频生成工具
│   │   ├── image-providers/        # 图像 Provider
│   │   ├── video-providers/        # 视频 Provider
│   │   └── utils/                  # 工具函数
│   ├── migrations/                 # 数据库迁移
│   ├── models/                     # 类型定义
│   └── utils/                      # 工具函数
├── package.json
├── tsconfig.json
└── README.md
```

## 安装和运行

```bash
# 安装依赖
cd server-node
npm install

# 开发模式运行
npm run dev

# 编译
npm run build

# 生产模式运行
npm start
```

## 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| PORT | 服务器端口 | 57988 |
| USER_DATA_DIR | 用户数据目录 | ./user_data |
| CONFIG_PATH | 配置文件路径 | USER_DATA_DIR/config.toml |
| SETTINGS_PATH | 设置文件路径 | USER_DATA_DIR/settings.json |
| UI_DIST_DIR | 前端构建目录 | ../react/dist |
| BASE_API_URL | Jaaz API URL | https://jaaz.app |

## API 端点

### 配置 API
- `GET /api/config/exists` - 检查配置文件是否存在
- `GET /api/config` - 获取应用配置
- `POST /api/config` - 更新应用配置

### 设置 API
- `GET /api/settings/exists` - 检查设置文件存在
- `GET /api/settings` - 获取所有设置
- `POST /api/settings` - 更新设置
- `GET /api/settings/proxy/status` - 获取代理状态
- `GET /api/settings/proxy` - 获取代理设置
- `POST /api/settings/proxy` - 更新代理设置

### 画布 API
- `GET /api/canvas/list` - 获取所有画布
- `POST /api/canvas/create` - 创建画布
- `GET /api/canvas/:id` - 获取画布数据
- `POST /api/canvas/:id/save` - 保存画布
- `POST /api/canvas/:id/rename` - 重命名画布
- `DELETE /api/canvas/:id/delete` - 删除画布

### 工作空间 API
- `POST /api/update_file` - 更新文件
- `POST /api/create_file` - 创建文件
- `POST /api/delete_file` - 删除文件
- `POST /api/rename_file` - 重命名文件
- `POST /api/read_file` - 读取文件
- `GET /api/list_files_in_dir` - 列出目录文件

### 聊天 API
- `POST /api/chat` - 发送聊天消息
- `POST /api/cancel/:sessionId` - 取消聊天
- `POST /api/magic` - 魔法生成请求

### 图像 API
- `POST /api/upload_image` - 上传图片
- `GET /api/file/:fileId` - 获取文件

## WebSocket 事件

### 服务端发送
- `init_done` - 初始化完成
- `connected` - 连接成功
- `pong` - 心跳响应
- `session_update` - 会话更新
- `delta` - 流式文本
- `tool_call` - 工具调用
- `tool_call_result` - 工具调用结果
- `image_generated` - 图像生成完成
- `done` - 处理完成
- `error` - 错误

### 客户端发送
- `ping` - 心跳检测

## 数据库

使用 SQLite 数据库，支持自动迁移：

- `chat_sessions` - 聊天会话
- `chat_messages` - 聊天消息
- `canvases` - 画布
- `comfy_workflows` - ComfyUI 工作流

## 注意事项

1. 所有代码添加中文注释
2. 使用 TypeScript 完整类型定义
3. 保持与 Python 版本的 API 兼容性
4. 异步操作使用 async/await

## 开发状态

- [x] 项目结构搭建
- [x] 核心服务实现
- [x] 数据库迁移
- [x] API 路由实现
- [x] WebSocket 支持
- [x] AI Agent 基础框架
- [ ] 完整的 LangChain.js 集成
- [ ] 所有图像生成 Provider
- [ ] 所有视频生成 Provider