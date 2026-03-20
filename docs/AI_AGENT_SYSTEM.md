# AI 智能体系统

## 系统概述

Jaaz 使用 LangGraph 构建多智能体系统，实现智能化的图像和视频生成。系统包含规划者 (Planner) 和创作者 (Creator) 两类智能体，通过智能体间的协作完成复杂的创意任务。

## 架构设计

### 多智能体架构

```
用户请求
    │
    ▼
┌─────────────────────────────────────────┐
│           LangGraph Swarm               │
│  ┌─────────────┐    ┌────────────────┐  │
│  │   Planner   │◀──▶│ Image/Video    │  │
│  │   Agent     │    │ Creator Agent  │  │
│  └─────────────┘    └────────────────┘  │
│         │                   │           │
│         └───────┬───────────┘           │
│                 ▼                       │
│         ┌───────────────┐               │
│         │    Tools      │               │
│         │ (图像/视频生成)│               │
│         └───────────────┘               │
└─────────────────────────────────────────┘
```

### 智能体类型

| 智能体 | 职责 | 工具 |
|--------|------|------|
| Planner Agent | 理解用户意图，规划任务 | write_plan, handoff |
| Image/Video Creator | 执行图像/视频生成 | 图像生成工具, 视频生成工具 |

## 核心服务

### AgentService (agent_service.py)

主入口服务，负责协调智能体处理用户请求：

```python
from langgraph_swarm import create_swarm
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama
from .agent_manager import AgentManager
from .StreamProcessor import StreamProcessor

async def langgraph_multi_agent(
    messages: List[Dict[str, Any]],
    canvas_id: str,
    session_id: str,
    text_model: ModelInfo,
    tool_list: List[ToolInfoJson],
    system_prompt: Optional[str] = None
) -> None:
    """多智能体处理函数"""

    # 1. 修复消息历史（处理不完整的工具调用）
    fixed_messages = _fix_chat_history(messages)

    # 2. 创建文本模型
    text_model_instance = _create_text_model(text_model)

    # 3. 创建智能体
    agents = AgentManager.create_agents(
        text_model_instance,
        tool_list,
        system_prompt or ""
    )

    # 4. 获取最后活跃的智能体
    agent_names = [agent.name for agent in agents]
    last_agent = AgentManager.get_last_active_agent(fixed_messages, agent_names)

    # 5. 创建智能体群组
    swarm = create_swarm(
        agents=agents,
        default_active_agent=last_agent or agent_names[0]
    )

    # 6. 创建上下文
    context = {
        'canvas_id': canvas_id,
        'session_id': session_id,
        'tool_list': tool_list,
    }

    # 7. 流处理
    processor = StreamProcessor(session_id, db_service, send_to_websocket)
    await processor.process_stream(swarm, fixed_messages, context)
```

### AgentManager (agent_manager.py)

智能体管理器，负责创建和配置智能体：

```python
from langgraph.prebuilt import create_react_agent
from typing import List, Dict, Any

class AgentManager:
    @staticmethod
    def create_agents(
        model: Any,
        tool_list: List[ToolInfoJson],
        system_prompt: str = ""
    ) -> List[CompiledGraph]:
        """创建所有智能体"""

        # 按类型过滤工具
        image_tools = [tool for tool in tool_list if tool.get('type') == 'image']
        video_tools = [tool for tool in tool_list if tool.get('type') == 'video']

        # 创建规划者智能体
        planner_config = PlannerAgentConfig()
        planner_agent = AgentManager._create_langgraph_agent(model, planner_config)

        # 创建创作者智能体
        image_video_creator_config = ImageVideoCreatorAgentConfig(tool_list)
        image_video_creator_agent = AgentManager._create_langgraph_agent(
            model, image_video_creator_config)

        return [planner_agent, image_video_creator_agent]

    @staticmethod
    def _create_langgraph_agent(
        model: Any,
        config: BaseAgentConfig
    ) -> CompiledGraph:
        """创建单个 LangGraph 智能体"""

        # 创建智能体间切换工具
        handoff_tools: List[BaseTool] = []
        for handoff in config.handoffs:
            handoff_tool = create_handoff_tool(
                agent_name=handoff['agent_name'],
                description=handoff['description'],
            )
            if handoff_tool:
                handoff_tools.append(handoff_tool)

        # 获取业务工具
        business_tools: List[BaseTool] = []
        for tool_json in config.tools:
            tool = tool_service.get_tool(tool_json['id'])
            if tool:
                business_tools.append(tool)

        # 创建 ReAct 智能体
        return create_react_agent(
            name=config.name,
            model=model,
            tools=[*business_tools, *handoff_tools],
            prompt=config.system_prompt
        )

    @staticmethod
    def get_last_active_agent(
        messages: List[Dict[str, Any]],
        agent_names: List[str]
    ) -> Optional[str]:
        """获取最后活跃的智能体"""
        for message in reversed(messages):
            if message.get('role') == 'assistant':
                message_name = message.get('name')
                if message_name and message_name in agent_names:
                    return message_name
        return None
```

### StreamProcessor (StreamProcessor.py)

流处理器，处理智能体输出的流式传输：

```python
from typing import Dict, Any
from langchain_core.messages import AIMessage, ToolMessage

class StreamProcessor:
    def __init__(self, session_id: str, db_service, send_callback):
        self.session_id = session_id
        self.db_service = db_service
        self.send_to_websocket = send_callback
        self.accumulated_content = ""

    async def process_stream(
        self,
        swarm: CompiledGraph,
        messages: List[Dict[str, Any]],
        context: Dict[str, Any]
    ):
        """处理智能体输出流"""
        async for event in swarm.astream(
            {"messages": messages},
            context=context
        ):
            await self._handle_event(event)

    async def _handle_event(self, event: Dict[str, Any]):
        """处理单个事件"""
        if 'messages' in event:
            for message in event['messages']:
                if isinstance(message, AIMessage):
                    await self._handle_ai_message(message)
                elif isinstance(message, ToolMessage):
                    await self._handle_tool_message(message)

    async def _handle_ai_message(self, message: AIMessage):
        """处理 AI 消息"""
        # 发送文本内容
        if message.content:
            await self.send_to_websocket(self.session_id, {
                'type': 'content',
                'content': message.content
            })

        # 发送工具调用
        if message.tool_calls:
            await self.send_to_websocket(self.session_id, {
                'type': 'tool_calls',
                'tool_calls': [
                    {
                        'id': tc['id'],
                        'name': tc['name'],
                        'args': tc['args']
                    }
                    for tc in message.tool_calls
                ]
            })

        # 保存消息到数据库
        await self.db_service.create_message(
            self.session_id,
            'assistant',
            json.dumps(message.dict())
        )
```

## 智能体配置

### 基础配置 (base_config.py)

```python
from abc import ABC, abstractmethod
from typing import List, Dict, Any
from langchain_core.tools import BaseTool

class BaseAgentConfig(ABC):
    """智能体配置基类"""

    @property
    @abstractmethod
    def name(self) -> str:
        """智能体名称"""
        pass

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """系统提示词"""
        pass

    @property
    @abstractmethod
    def tools(self) -> List[Dict[str, Any]]:
        """工具列表"""
        pass

    @property
    @abstractmethod
    def handoffs(self) -> List[Dict[str, str]]:
        """智能体切换配置"""
        pass

def create_handoff_tool(agent_name: str, description: str) -> BaseTool:
    """创建智能体切换工具"""
    from langchain_core.tools import tool

    @tool
    def handoff_to_agent():
        f"""{description}"""
        return f"Transferring to {agent_name}"

    return handoff_to_agent
```

### Planner 配置 (planner_config.py)

```python
class PlannerAgentConfig(BaseAgentConfig):
    """规划者智能体配置"""

    @property
    def name(self) -> str:
        return "planner"

    @property
    def system_prompt(self) -> str:
        return """你是一个创意规划助手，帮助用户规划图像和视频创作任务。

你的职责是：
1. 理解用户的创作意图
2. 分析需求并制定创作计划
3. 将任务分配给合适的创作者智能体

当用户需要生成图像或视频时，请使用 handoff_to_image_video_creator 工具将任务转交给创作者。"""

    @property
    def tools(self) -> List[Dict[str, Any]]:
        return [{"id": "write_plan"}]

    @property
    def handoffs(self) -> List[Dict[str, str]]:
        return [
            {
                "agent_name": "image_video_creator",
                "description": "当需要生成图像或视频时使用此工具"
            }
        ]
```

### Image/Video Creator 配置

```python
class ImageVideoCreatorAgentConfig(BaseAgentConfig):
    """图像/视频创作者智能体配置"""

    def __init__(self, tool_list: List[ToolInfoJson]):
        self._tools = tool_list

    @property
    def name(self) -> str:
        return "image_video_creator"

    @property
    def system_prompt(self) -> str:
        return """你是一个专业的图像和视频创作者，负责根据用户的描述生成高质量的视觉内容。

你可以使用以下工具：
- 图像生成工具：根据文本描述生成图像
- 视频生成工具：根据文本或图像生成视频

请根据用户的需求选择合适的工具进行创作。"""

    @property
    def tools(self) -> List[Dict[str, Any]]:
        return [{"id": tool['id']} for tool in self._tools]

    @property
    def handoffs(self) -> List[Dict[str, str]]:
        return [
            {
                "agent_name": "planner",
                "description": "当需要重新规划任务时使用此工具"
            }
        ]
```

## 消息历史修复

处理不完整的工具调用，避免 LangGraph 错误：

```python
def _fix_chat_history(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """修复聊天历史中不完整的工具调用"""

    if not messages:
        return messages

    fixed_messages: List[Dict[str, Any]] = []
    tool_call_ids: Set[str] = set()

    # 收集所有 ToolMessage 的 tool_call_id
    for msg in messages:
        if msg.get('role') == 'tool' and msg.get('tool_call_id'):
            tool_call_ids.add(msg.get('tool_call_id'))

    # 修复 AIMessage 中的 tool_calls
    for msg in messages:
        if msg.get('role') == 'assistant' and msg.get('tool_calls'):
            # 过滤掉没有对应 ToolMessage 的 tool_calls
            valid_tool_calls = [
                tc for tc in msg.get('tool_calls', [])
                if tc.get('id') in tool_call_ids
            ]

            if valid_tool_calls:
                msg_copy = msg.copy()
                msg_copy['tool_calls'] = valid_tool_calls
                fixed_messages.append(msg_copy)
            elif msg.get('content'):
                msg_copy = msg.copy()
                msg_copy.pop('tool_calls', None)
                fixed_messages.append(msg_copy)
        else:
            fixed_messages.append(msg)

    return fixed_messages
```

## 文本模型创建

支持 OpenAI 和 Ollama 两种模型：

```python
def _create_text_model(text_model: ModelInfo) -> Any:
    """创建语言模型实例"""
    model = text_model.get('model')
    provider = text_model.get('provider')
    url = text_model.get('url')
    api_key = config_service.app_config.get(provider, {}).get("api_key", "")

    if provider == 'ollama':
        return ChatOllama(
            model=model,
            base_url=url,
        )
    else:
        http_client = HttpClient.create_sync_client()
        http_async_client = HttpClient.create_async_client()
        return ChatOpenAI(
            model=model,
            api_key=api_key,
            timeout=300,
            base_url=url,
            temperature=0,
            http_client=http_client,
            http_async_client=http_async_client
        )
```

## 工作流程

### 完整处理流程

```
1. 用户发送消息
    │
    ▼
2. Chat Service 接收请求
    │
    ▼
3. 加载聊天历史
    │
    ▼
4. 修复消息历史
    │
    ▼
5. 创建文本模型实例
    │
    ▼
6. 创建智能体 (Planner + Creator)
    │
    ▼
7. 创建 Swarm
    │
    ▼
8. 确定默认活跃智能体
    │
    ▼
9. 流式执行智能体
    │
    ├── 文本响应 → WebSocket 推送
    ├── 工具调用 → WebSocket 推送
    └── 工具结果 → WebSocket 推送
    │
    ▼
10. 保存消息到数据库
```

### 智能体切换流程

```
Planner Agent
    │
    │ 用户请求生成图像
    ▼
handoff_to_image_video_creator
    │
    ▼
Image/Video Creator Agent
    │
    │ 执行图像生成工具
    ▼
Tool: generate_image_xxx
    │
    │ 生成完成
    ▼
返回结果给用户
```

## 错误处理

```python
async def _handle_error(error: Exception, session_id: str) -> None:
    """处理错误"""
    print('Error in langgraph_agent', error)
    traceback.print_exc()

    await send_to_websocket(session_id, {
        'type': 'error',
        'error': str(error)
    })
```