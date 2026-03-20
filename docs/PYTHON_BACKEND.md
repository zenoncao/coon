# Python 后端模块

## 模块概述

Python 后端是 Jaaz 的核心服务层，基于 FastAPI 构建，提供 REST API 和 WebSocket 服务，集成 LangGraph 多智能体系统，支持图像/视频生成功能。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.12+ | 编程语言 |
| FastAPI | 最新 | Web 框架 |
| Uvicorn | 最新 | ASGI 服务器 |
| python-socketio | 最新 | WebSocket 服务 |
| LangGraph | 最新 | 多智能体框架 |
| LangChain | 最新 | LLM 集成 |
| aiosqlite | 最新 | 异步 SQLite |

## 服务入口 (main.py)

### 应用结构

```python
# main.py
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import socketio

# 导入路由
from routers import config_router, image_router, chat_router, canvas, workspace, settings
from routers.websocket_router import *

# 导入服务
from services.websocket_state import sio
from services.config_service import config_service
from services.tool_service import tool_service

# 生命周期管理
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时初始化
    await config_service.initialize()
    await tool_service.initialize()
    yield
    # 关闭时清理

# 创建应用
app = FastAPI(lifespan=lifespan)

# 注册路由
app.include_router(config_router.router)
app.include_router(settings.router)
app.include_router(canvas.router)
app.include_router(chat_router.router)

# 挂载静态文件
app.mount("/assets", StaticFiles(directory="react/dist/assets"), name="assets")

# 创建 Socket.IO 应用
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path='/socket.io')
```

### 启动配置

```python
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=57988)
    args = parser.parse_args()

    import uvicorn
    uvicorn.run(socket_app, host="127.0.0.1", port=args.port)
```

## 路由模块

### 路由结构

```
routers/
├── __init__.py
├── root_router.py      # 根路由
├── config_router.py    # 配置 API
├── settings.py         # 设置 API
├── canvas.py           # 画布 API
├── workspace.py        # 工作空间 API
├── chat_router.py      # 聊天 API
├── image_router.py     # 图像 API
├── websocket_router.py # WebSocket 路由
├── tool_confirmation.py # 工具确认
└── ssl_test.py         # SSL 测试
```

### 聊天路由 (chat_router.py)

```python
from fastapi import APIRouter, Request
from services.chat_service import handle_chat

router = APIRouter(prefix="/api")

@router.post("/chat")
async def chat(request: Request):
    """处理聊天请求"""
    data = await request.json()
    await handle_chat(data)
    return {"status": "done"}

@router.post("/cancel/{session_id}")
async def cancel_chat(session_id: str):
    """取消进行中的聊天"""
    task = get_stream_task(session_id)
    if task and not task.done():
        task.cancel()
        return {"status": "cancelled"}
    return {"status": "not_found_or_done"}

@router.post("/magic")
async def magic(request: Request):
    """处理魔法生成请求"""
    data = await request.json()
    await handle_magic(data)
    return {"status": "done"}
```

### 画布路由 (canvas.py)

```python
from fastapi import APIRouter
from services.db_service import db_service

router = APIRouter(prefix="/api/canvas")

@router.get("/{canvas_id}")
async def get_canvas(canvas_id: str):
    """获取画布数据"""
    data = await db_service.get_canvas_data(canvas_id)
    return data

@router.post("/{canvas_id}")
async def save_canvas(canvas_id: str, data: CanvasData):
    """保存画布数据"""
    await db_service.save_canvas_data(
        canvas_id,
        json.dumps(data.data),
        data.thumbnail
    )
    return {"status": "success"}

@router.delete("/{canvas_id}")
async def delete_canvas(canvas_id: str):
    """删除画布"""
    await db_service.delete_canvas(canvas_id)
    return {"status": "success"}
```

## 核心服务

### 配置服务 (config_service.py)

管理应用配置，包括 API 密钥、模型配置等：

```python
from typing import Dict, Any
import json
import os

USER_DATA_DIR = os.environ.get('USER_DATA_DIR', os.path.expanduser('~/.jaaz'))
CONFIG_PATH = os.path.join(USER_DATA_DIR, 'config.json')

class ConfigService:
    def __init__(self):
        self.app_config: Dict[str, Any] = {}

    async def initialize(self):
        """初始化配置"""
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, 'r') as f:
                self.app_config = json.load(f)

    def get_provider_config(self, provider: str) -> Dict[str, Any]:
        """获取 Provider 配置"""
        return self.app_config.get(provider, {})

    async def update_config(self, config: Dict[str, Any]):
        """更新配置"""
        self.app_config.update(config)
        with open(CONFIG_PATH, 'w') as f:
            json.dump(self.app_config, f, indent=2)

config_service = ConfigService()
```

### 数据库服务 (db_service.py)

SQLite 数据库管理，支持画布、聊天会话、ComfyUI 工作流等：

```python
import sqlite3
import aiosqlite
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(USER_DATA_DIR, "localmanus.db")

class DatabaseService:
    def __init__(self):
        self.db_path = DB_PATH
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS canvases (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    data TEXT,
                    thumbnail TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    model TEXT,
                    provider TEXT,
                    canvas_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    role TEXT,
                    message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

    async def create_canvas(self, id: str, name: str):
        """创建画布"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO canvases (id, name) VALUES (?, ?)",
                (id, name)
            )
            await db.commit()

    async def get_canvas_data(self, id: str) -> Optional[Dict[str, Any]]:
        """获取画布数据"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute(
                "SELECT data, name FROM canvases WHERE id = ?",
                (id,)
            )
            row = await cursor.fetchone()
            if row:
                return {
                    'data': json.loads(row['data']) if row['data'] else {},
                    'name': row['name'],
                    'sessions': await self.list_sessions(id)
                }
            return None

    async def get_chat_history(self, session_id: str) -> List[Dict[str, Any]]:
        """获取聊天历史"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute(
                "SELECT role, message FROM chat_messages WHERE session_id = ? ORDER BY id",
                (session_id,)
            )
            rows = await cursor.fetchall()
            return [json.loads(row['message']) for row in rows if row['message']]

db_service = DatabaseService()
```

### WebSocket 服务 (websocket_service.py)

实时通信服务，推送 AI 响应和生成结果：

```python
from services.websocket_state import sio, get_all_socket_ids
from typing import Any, Dict

async def broadcast_session_update(
    session_id: str,
    canvas_id: str | None,
    event: Dict[str, Any]
):
    """广播会话更新"""
    socket_ids = get_all_socket_ids()
    for socket_id in socket_ids:
        await sio.emit('session_update', {
            'canvas_id': canvas_id,
            'session_id': session_id,
            **event
        }, room=socket_id)

async def send_to_websocket(session_id: str, event: Dict[str, Any]):
    """发送消息到 WebSocket"""
    await broadcast_session_update(session_id, None, event)

async def broadcast_init_done():
    """广播初始化完成"""
    await sio.emit('init_done', {'type': 'init_done'})
```

### WebSocket 状态 (websocket_state.py)

```python
import socketio

# 创建 Socket.IO 服务器
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*'
)

# 存储所有连接的 socket ID
connected_sockets: set = set()

@sio.event
async def connect(sid, environ):
    """连接事件"""
    connected_sockets.add(sid)
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    """断开连接事件"""
    connected_sockets.discard(sid)
    print(f"Client disconnected: {sid}")

def get_all_socket_ids() -> list:
    """获取所有 socket ID"""
    return list(connected_sockets)
```

### 工具服务 (tool_service.py)

管理图像/视频生成工具：

```python
from typing import Dict
from langchain_core.tools import BaseTool
from models.tool_model import ToolInfo

# 工具映射表
TOOL_MAPPING: Dict[str, ToolInfo] = {
    "generate_image_by_gpt_image_1_jaaz": {
        "display_name": "GPT Image 1",
        "type": "image",
        "provider": "jaaz",
        "tool_function": generate_image_by_gpt_image_1_jaaz,
    },
    "generate_image_by_imagen_4_jaaz": {
        "display_name": "Imagen 4",
        "type": "image",
        "provider": "jaaz",
        "tool_function": generate_image_by_imagen_4_jaaz,
    },
    # ... 更多工具
}

class ToolService:
    def __init__(self):
        self.tools: Dict[str, ToolInfo] = {}

    async def initialize(self):
        """初始化工具服务"""
        self.clear_tools()
        # 根据配置注册工具
        for provider_name, provider_config in config_service.app_config.items():
            if provider_config.get("api_key", ""):
                for tool_id, tool_info in TOOL_MAPPING.items():
                    if tool_info.get("provider") == provider_name:
                        self.register_tool(tool_id, tool_info)

    def register_tool(self, tool_id: str, tool_info: ToolInfo):
        """注册工具"""
        self.tools[tool_id] = tool_info

    def get_tool(self, tool_name: str) -> BaseTool | None:
        """获取工具"""
        tool_info = self.tools.get(tool_name)
        return tool_info.get("tool_function") if tool_info else None

tool_service = ToolService()
```

### 聊天服务 (chat_service.py)

处理聊天请求，协调多智能体系统：

```python
from services.langgraph_service.agent_service import langgraph_multi_agent
from services.db_service import db_service
from services.stream_service import create_stream_task

async def handle_chat(data: dict):
    """处理聊天请求"""
    session_id = data.get('session_id')
    canvas_id = data.get('canvas_id')
    messages = data.get('messages', [])
    text_model = data.get('text_model')
    tool_list = data.get('tool_list', [])
    system_prompt = data.get('system_prompt', '')

    # 保存用户消息
    if messages:
        last_message = messages[-1]
        await db_service.create_message(session_id, last_message['role'], json.dumps(last_message))

    # 创建异步任务
    async def run_agent():
        await langgraph_multi_agent(
            messages=messages,
            canvas_id=canvas_id,
            session_id=session_id,
            text_model=text_model,
            tool_list=tool_list,
            system_prompt=system_prompt
        )

    create_stream_task(session_id, run_agent())
```

### 流处理服务 (stream_service.py)

管理异步任务，支持取消：

```python
import asyncio
from typing import Dict, Task

stream_tasks: Dict[str, Task] = {}

def create_stream_task(session_id: str, coro):
    """创建流处理任务"""
    task = asyncio.create_task(coro)
    stream_tasks[session_id] = task
    return task

def get_stream_task(session_id: str) -> Task | None:
    """获取流处理任务"""
    return stream_tasks.get(session_id)
```

## 数据库迁移

### 迁移管理器

```python
# services/migrations/manager.py
CURRENT_VERSION = 3

class MigrationManager:
    def migrate(self, conn, from_version: int, to_version: int):
        """执行数据库迁移"""
        migrations = [
            v1_initial_schema,
            v2_add_canvases,
            v3_add_comfy_workflow,
        ]

        for i in range(from_version, to_version):
            migrations[i].up(conn)
            conn.execute("UPDATE db_version SET version = ?", (i + 1,))
```

### 迁移示例

```python
# services/migrations/v1_initial_schema.py
def up(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            title TEXT,
            model TEXT,
            provider TEXT,
            canvas_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            role TEXT,
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
```

## HTTP 客户端

### 自定义 HTTP 客户端

```python
# utils/http_client.py
import httpx

class HttpClient:
    @staticmethod
    def create_sync_client() -> httpx.Client:
        return httpx.Client(
            timeout=300,
            verify=True,
        )

    @staticmethod
    def create_async_client() -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=300,
            verify=True,
        )
```

## 静态文件服务

### 无缓存静态文件

```python
class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope) -> Response:
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"
        return response
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `DEFAULT_PORT` | 服务端口 (默认 57988) |
| `UI_DIST_DIR` | 前端静态文件目录 |
| `USER_DATA_DIR` | 用户数据目录 |
| `IS_PACKAGED` | 是否为打包后的应用 |
| `BASE_API_URL` | 基础 API URL |

## 启动流程

```
1. 解析命令行参数
2. 配置环境变量
3. 创建 FastAPI 应用
4. 注册路由和中间件
5. 初始化配置服务
6. 初始化工具服务
7. 挂载静态文件
8. 创建 Socket.IO 应用
9. 启动 Uvicorn 服务器
```