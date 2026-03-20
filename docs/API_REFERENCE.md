# API 参考

## HTTP API

### 基础信息

- **基础 URL**: `http://127.0.0.1:57988` (端口可配置)
- **内容类型**: `application/json`

### 聊天 API

#### POST /api/chat

发送聊天消息，触发 AI 智能体处理。

**请求体**:
```json
{
  "session_id": "string",           // 会话 ID
  "canvas_id": "string",            // 画布 ID
  "messages": [                     // 消息历史
    {
      "role": "user",
      "content": "生成一张猫的图片"
    }
  ],
  "text_model": {                   // 文本模型配置
    "provider": "openai",
    "model": "gpt-4o",
    "url": "https://api.openai.com/v1"
  },
  "tool_list": [                    // 可用工具列表
    {
      "id": "generate_image_by_imagen_4_jaaz",
      "type": "image"
    }
  ],
  "system_prompt": "string"         // 可选的系统提示词
}
```

**响应**:
```json
{
  "status": "done"
}
```

#### POST /api/cancel/{session_id}

取消进行中的聊天任务。

**响应**:
```json
{
  "status": "cancelled"  // 或 "not_found_or_done"
}
```

### 画布 API

#### GET /api/canvas/{canvas_id}

获取画布数据。

**响应**:
```json
{
  "data": {                         // Excalidraw 数据
    "elements": [],
    "appState": {}
  },
  "name": "画布名称",
  "sessions": [                     // 关联的聊天会话
    {
      "id": "session-1",
      "title": "会话标题",
      "model": "gpt-4o",
      "provider": "openai"
    }
  ]
}
```

#### POST /api/canvas/{canvas_id}

保存画布数据。

**请求体**:
```json
{
  "data": {                         // Excalidraw 数据
    "elements": [],
    "appState": {},
    "files": {}
  },
  "thumbnail": "data:image/png;base64,..."  // 可选缩略图
}
```

**响应**:
```json
{
  "status": "success"
}
```

#### POST /api/canvas/create

创建新画布。

**请求体**:
```json
{
  "id": "canvas-123",
  "name": "新画布"
}
```

#### DELETE /api/canvas/{canvas_id}

删除画布。

#### GET /api/canvas/list

获取所有画布列表。

**响应**:
```json
[
  {
    "id": "canvas-1",
    "name": "画布1",
    "thumbnail": "...",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

### 配置 API

#### GET /api/config

获取应用配置。

**响应**:
```json
{
  "openai": {
    "api_key": "sk-...",
    "url": "https://api.openai.com/v1"
  },
  "jaaz": {
    "api_key": "..."
  },
  "ollama": {
    "url": "http://localhost:11434"
  },
  "comfyui": {
    "url": "http://127.0.0.1:8188"
  }
}
```

#### POST /api/config

更新应用配置。

**请求体**:
```json
{
  "openai": {
    "api_key": "sk-..."
  }
}
```

### 模型 API

#### GET /api/models

获取可用模型列表。

**响应**:
```json
{
  "text_models": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "display_name": "GPT-4o"
    }
  ],
  "image_models": [
    {
      "provider": "jaaz",
      "model": "imagen-4",
      "display_name": "Imagen 4"
    }
  ],
  "video_models": [
    {
      "provider": "jaaz",
      "model": "veo3-fast",
      "display_name": "Veo3 Fast"
    }
  ]
}
```

### 会话 API

#### GET /api/sessions

获取所有聊天会话。

**查询参数**:
- `canvas_id` (可选): 按画布 ID 过滤

**响应**:
```json
[
  {
    "id": "session-1",
    "title": "会话标题",
    "model": "gpt-4o",
    "provider": "openai",
    "canvas_id": "canvas-1",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### GET /api/sessions/{session_id}/history

获取会话聊天历史。

**响应**:
```json
[
  {
    "role": "user",
    "content": "生成一张图片"
  },
  {
    "role": "assistant",
    "content": "好的，我来为你生成一张图片...",
    "tool_calls": [
      {
        "id": "call-1",
        "name": "generate_image_by_imagen_4_jaaz",
        "args": {"prompt": "..."}
      }
    ]
  }
]
```

### 魔法功能 API

#### POST /api/magic

处理魔法生成请求。

**请求体**:
```json
{
  "session_id": "string",
  "canvas_id": "string",
  "elements": [],           // 选中的画布元素
  "prompt": "string"        // 用户指令
}
```

#### POST /api/magic/cancel/{session_id}

取消魔法生成任务。

### ComfyUI 工作流 API

#### GET /api/comfy/workflows

获取所有 ComfyUI 工作流。

**响应**:
```json
[
  {
    "id": 1,
    "name": "SDXL Workflow",
    "description": "SDXL 图像生成工作流",
    "inputs": ["prompt", "negative_prompt"],
    "outputs": ["image"]
  }
]
```

#### POST /api/comfy/workflows

创建 ComfyUI 工作流。

**请求体**:
```json
{
  "name": "SDXL Workflow",
  "api_json": {...},           // ComfyUI API JSON
  "description": "描述",
  "inputs": ["prompt"],
  "outputs": ["image"]
}
```

#### DELETE /api/comfy/workflows/{id}

删除 ComfyUI 工作流。

## WebSocket 事件

### 连接

```javascript
const socket = io('http://127.0.0.1:57988', {
  path: '/socket.io',
  transports: ['websocket']
})
```

### 客户端接收事件

#### session_update

会话更新事件，包含 AI 响应流。

**数据格式**:
```json
{
  "canvas_id": "canvas-1",
  "session_id": "session-1",
  "type": "content",           // 事件类型
  "content": "AI 响应文本..."
}
```

**事件类型**:
| 类型 | 说明 |
|------|------|
| `content` | AI 文本内容 |
| `tool_start` | 工具开始执行 |
| `tool_calls` | 工具调用信息 |
| `tool_result` | 工具执行结果 |
| `image_generated` | 图像生成完成 |
| `video_generated` | 视频生成完成 |
| `error` | 错误信息 |

#### init_done

服务初始化完成事件。

**数据格式**:
```json
{
  "type": "init_done"
}
```

### 服务端推送示例

#### 文本内容推送

```json
{
  "type": "content",
  "content": "我来为你生成一张图片..."
}
```

#### 工具调用推送

```json
{
  "type": "tool_calls",
  "tool_calls": [
    {
      "id": "call-123",
      "name": "generate_image_by_imagen_4_jaaz",
      "args": {
        "prompt": "一只可爱的猫咪",
        "aspect_ratio": "1:1"
      }
    }
  ]
}
```

#### 图像生成完成推送

```json
{
  "type": "image_generated",
  "canvas_id": "canvas-1",
  "element": {
    "id": "element-1",
    "type": "image",
    "x": 100,
    "y": 100,
    "width": 1024,
    "height": 1024,
    "fileId": "image-123.png"
  },
  "file": {
    "mimeType": "image/png",
    "id": "file-1",
    "dataURL": "file:///path/to/image.png"
  }
}
```

#### 视频生成完成推送

```json
{
  "type": "video_generated",
  "canvas_id": "canvas-1",
  "element": {
    "id": "element-1",
    "type": "embeddable",
    "x": 100,
    "y": 100,
    "width": 640,
    "height": 360
  },
  "video_url": "file:///path/to/video.mp4"
}
```

#### 错误推送

```json
{
  "type": "error",
  "error": "API key is invalid"
}
```

## IPC 接口

### 文件选择

#### pickImage

选择图片文件。

```javascript
const filePaths = await window.electronAPI.pickImage()
// 返回: string[] | null
```

#### pickVideo

选择视频文件。

```javascript
const filePath = await window.electronAPI.pickVideo()
// 返回: string | null
```

### ComfyUI 管理

#### installComfyUI

安装 ComfyUI。

```javascript
const result = await window.electronAPI.installComfyUI()
// 返回: { success: boolean, message?: string, error?: string }
```

#### uninstallComfyUI

卸载 ComfyUI。

```javascript
const result = await window.electronAPI.uninstallComfyUI()
```

#### checkComfyUIInstalled

检查 ComfyUI 是否已安装。

```javascript
const isInstalled = await window.electronAPI.checkComfyUIInstalled()
// 返回: boolean
```

#### startComfyUIProcess

启动 ComfyUI 进程。

```javascript
const result = await window.electronAPI.startComfyUIProcess()
// 返回: { success: boolean, message?: string }
```

#### stopComfyUIProcess

停止 ComfyUI 进程。

```javascript
const result = await window.electronAPI.stopComfyUIProcess()
```

#### getComfyUIProcessStatus

获取 ComfyUI 进程状态。

```javascript
const status = await window.electronAPI.getComfyUIProcessStatus()
// 返回: { running: boolean, port?: number }
```

### 自动更新

#### checkForUpdates

检查应用更新。

```javascript
const result = await window.electronAPI.checkForUpdates()
// 返回: { message: string }
```

#### restartAndInstall

重启并安装更新。

```javascript
await window.electronAPI.restartAndInstall()
```

#### onUpdateDownloaded

监听更新下载完成事件。

```javascript
window.electronAPI.onUpdateDownloaded((info) => {
  console.log('新版本已下载:', info.version)
})
```

#### removeUpdateDownloadedListener

移除更新监听器。

```javascript
window.electronAPI.removeUpdateDownloadedListener()
```

### 外部链接

#### openBrowserUrl

在默认浏览器中打开链接。

```javascript
const result = await window.electronAPI.openBrowserUrl('https://jaaz.app')
// 返回: { success: boolean, error?: string }
```

## 错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 请求示例

### JavaScript/TypeScript

```typescript
// 发送聊天消息
async function sendMessage(sessionId: string, message: string) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      canvas_id: 'canvas-1',
      messages: [{ role: 'user', content: message }],
      text_model: { provider: 'openai', model: 'gpt-4o' },
      tool_list: [{ id: 'generate_image_by_imagen_4_jaaz', type: 'image' }]
    })
  })
  return response.json()
}

// WebSocket 连接
const socket = io('/', { path: '/socket.io' })
socket.on('session_update', (data) => {
  console.log('收到更新:', data)
})
```

### Python

```python
import requests
import socketio

# REST API
response = requests.post('http://127.0.0.1:57988/api/chat', json={
    'session_id': 'session-1',
    'canvas_id': 'canvas-1',
    'messages': [{'role': 'user', 'content': '你好'}],
    'text_model': {'provider': 'openai', 'model': 'gpt-4o'},
    'tool_list': []
})

# WebSocket
sio = socketio.Client()
sio.connect('http://127.0.0.1:57988', socketio_path='/socket.io')

@sio.on('session_update')
def on_update(data):
    print('收到更新:', data)
```