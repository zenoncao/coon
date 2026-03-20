# 图像/视频生成系统

## 系统概述

Jaaz 的图像/视频生成系统采用 Provider 架构，支持多种云端和本地生成服务。系统通过统一的接口抽象，使智能体可以无缝调用不同的生成服务。

## 架构设计

### Provider 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Tool Service                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 Tool Mapping                          │   │
│  │  generate_image_by_xxx → ToolInfo                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Image Providers                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  Jaaz   │ │Replicate│ │ Volces  │ │ ComfyUI │           │
│  │ Provider│ │ Provider│ │ Provider│ │ Provider│           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Video Providers                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  Jaaz   │ │ Volces  │ │ Hailuo  │ │  Kling  │           │
│  │ Provider│ │ Provider│ │ Provider│ │ Provider│           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## 图像生成系统

### 基础 Provider 接口

```python
# tools/image_providers/image_base_provider.py
from abc import ABC, abstractmethod
from typing import Optional, Any, Tuple

class ImageProviderBase(ABC):
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_images: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
        **kwargs: Any
    ) -> Tuple[str, int, int, str]:
        """
        生成图像并返回图像详情

        Args:
            prompt: 图像生成提示词
            model: 模型名称
            aspect_ratio: 图像比例 (1:1, 16:9, 4:3, 3:4, 9:16)
            input_images: 可选的输入图像（用于参考或编辑）
            metadata: 可选的元数据（保存到 PNG info）

        Returns:
            Tuple[str, int, int, str]: (mime_type, width, height, filename)
        """
        pass
```

### Jaaz Provider

Jaaz 官方云服务 Provider：

```python
# tools/image_providers/jaaz_provider.py
from .image_base_provider import ImageProviderBase
import httpx

class JaazImageProvider(ImageProviderBase):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.jaaz.app"

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_images: Optional[list[str]] = None,
        **kwargs
    ) -> Tuple[str, int, int, str]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/images/generate",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "prompt": prompt,
                    "model": model,
                    "aspect_ratio": aspect_ratio,
                    "input_images": input_images,
                }
            )
            result = response.json()

            # 下载图像
            image_url = result["url"]
            image_data = await self._download_image(image_url)

            # 保存图像
            filename = await self._save_image(image_data)

            return "image/png", result["width"], result["height"], filename
```

### Replicate Provider

Replicate 平台 Provider：

```python
# tools/image_providers/replicate_provider.py
import replicate
from .image_base_provider import ImageProviderBase

class ReplicateImageProvider(ImageProviderBase):
    def __init__(self, api_key: str):
        self.api_key = api_key
        replicate.Client(api_token=api_key)

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        **kwargs
    ) -> Tuple[str, int, int, str]:
        # 调用 Replicate API
        output = replicate.run(
            f"jaaz/{model}",
            input={
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
            }
        )

        # 处理输出
        # ...
        return mime_type, width, height, filename
```

### ComfyUI Provider

本地 ComfyUI Provider：

```python
# tools/image_providers/comfyui_provider.py
from .image_base_provider import ImageProviderBase
import aiohttp

class ComfyUIImageProvider(ImageProviderBase):
    def __init__(self, base_url: str = "http://127.0.0.1:8188"):
        self.base_url = base_url

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        workflow: Optional[dict] = None,
        **kwargs
    ) -> Tuple[str, int, int, str]:
        # 提交工作流
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/prompt",
                json={"prompt": workflow or self._default_workflow(prompt)}
            ) as response:
                result = await response.json()
                prompt_id = result["prompt_id"]

        # 等待完成
        image_data = await self._wait_for_completion(prompt_id)

        # 保存图像
        filename = await self._save_image(image_data)

        return "image/png", width, height, filename
```

### 支持的图像模型

| 工具 ID | 显示名称 | Provider | 类型 |
|---------|----------|----------|------|
| generate_image_by_gpt_image_1_jaaz | GPT Image 1 | Jaaz | 图像 |
| generate_image_by_imagen_4_jaaz | Imagen 4 | Jaaz | 图像 |
| generate_image_by_imagen_4_replicate | Imagen 4 | Replicate | 图像 |
| generate_image_by_recraft_v3_jaaz | Recraft v3 | Jaaz | 图像 |
| generate_image_by_ideogram3_bal_jaaz | Ideogram 3 Balanced | Jaaz | 图像 |
| generate_image_by_flux_kontext_pro_jaaz | Flux Kontext Pro | Jaaz | 图像 |
| generate_image_by_flux_kontext_max_jaaz | Flux Kontext Max | Jaaz | 图像 |
| generate_image_by_midjourney_jaaz | Midjourney | Jaaz | 图像 |
| generate_image_by_doubao_seedream_3_jaaz | Doubao Seedream 3 | Jaaz | 图像 |
| generate_image_by_doubao_seedream_3_volces | Doubao Seedream 3 | Volces | 图像 |
| edit_image_by_doubao_seededit_3_volces | Doubao Seededit 3 | Volces | 图像 |

## 视频生成系统

### 基础 Provider 接口

```python
# tools/video_providers/video_base_provider.py
from abc import ABC, abstractmethod
from typing import Optional, Any, Tuple

class VideoProviderBase(ABC):
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: str,
        duration: float = 5.0,
        aspect_ratio: str = "16:9",
        input_image: Optional[str] = None,
        **kwargs: Any
    ) -> Tuple[str, str]:
        """
        生成视频并返回视频详情

        Args:
            prompt: 视频生成提示词
            model: 模型名称
            duration: 视频时长（秒）
            aspect_ratio: 视频比例
            input_image: 可选的输入图像（图生视频）

        Returns:
            Tuple[str, str]: (mime_type, video_url)
        """
        pass
```

### 支持的视频模型

| 工具 ID | 显示名称 | Provider | 类型 |
|---------|----------|----------|------|
| generate_video_by_seedance_v1_jaaz | Doubao Seedance v1 | Jaaz | 视频 |
| generate_video_by_hailuo_02_jaaz | Hailuo 02 | Jaaz | 视频 |
| generate_video_by_kling_v2_jaaz | Kling v2.1 Standard | Jaaz | 视频 |
| generate_video_by_veo3_fast_jaaz | Veo3 Fast | Jaaz | 视频 |
| generate_video_by_seedance_v1_pro_volces | Doubao Seedance v1 Pro | Volces | 视频 |
| generate_video_by_seedance_v1_lite_volces_t2v | Doubao Seedance v1 Lite T2V | Volces | 视频 |
| generate_video_by_seedance_v1_lite_i2v_volces | Doubao Seedance v1 Lite I2V | Volces | 视频 |

## 工具实现示例

### 图像生成工具

```python
# tools/generate_image_by_imagen_4_jaaz.py
from langchain_core.tools import tool
from tools.image_providers.jaaz_provider import JaazImageProvider
from tools.utils.image_generation_core import generate_image_core
from services.config_service import config_service

@tool
async def generate_image_by_imagen_4_jaaz(
    prompt: str,
    aspect_ratio: str = "1:1",
    input_images: list[str] = [],
) -> str:
    """
    使用 Imagen 4 模型生成高质量图像。

    Args:
        prompt: 图像描述
        aspect_ratio: 图像比例 (1:1, 16:9, 4:3, 3:4, 9:16)
        input_images: 参考图像路径列表

    Returns:
        str: 生成结果的描述
    """
    api_key = config_service.app_config.get("jaaz", {}).get("api_key", "")
    provider = JaazImageProvider(api_key)

    return await generate_image_core(
        provider=provider,
        prompt=prompt,
        model="imagen-4",
        aspect_ratio=aspect_ratio,
        input_images=input_images,
    )
```

### 核心生成函数

```python
# tools/utils/image_generation_core.py
from tools.image_providers.image_base_provider import ImageProviderBase
from tools.utils.image_canvas_utils import add_image_to_canvas
from services.websocket_service import send_to_websocket
import uuid

async def generate_image_core(
    provider: ImageProviderBase,
    prompt: str,
    model: str,
    aspect_ratio: str = "1:1",
    input_images: list[str] = [],
    canvas_id: str = None,
    session_id: str = None,
) -> str:
    """图像生成核心函数"""

    # 生成唯一 ID
    image_id = str(uuid.uuid4())

    # 发送开始事件
    await send_to_websocket(session_id, {
        'type': 'tool_start',
        'tool_name': 'generate_image',
        'tool_input': {'prompt': prompt}
    })

    try:
        # 调用 Provider 生成图像
        mime_type, width, height, filename = await provider.generate(
            prompt=prompt,
            model=model,
            aspect_ratio=aspect_ratio,
            input_images=input_images,
        )

        # 添加图像到画布
        element = await add_image_to_canvas(
            canvas_id=canvas_id,
            filename=filename,
            width=width,
            height=height,
        )

        # 发送完成事件
        await send_to_websocket(session_id, {
            'type': 'image_generated',
            'canvas_id': canvas_id,
            'element': element,
            'file': {
                'mimeType': mime_type,
                'id': image_id,
                'dataURL': f"file://{filename}"
            }
        })

        return f"成功生成图像: {filename}"

    except Exception as e:
        await send_to_websocket(session_id, {
            'type': 'tool_error',
            'error': str(e)
        })
        raise
```

### 视频生成核心

```python
# tools/video_generation/video_generation_core.py
from tools.video_providers.video_base_provider import VideoProviderBase
from tools.video_generation.video_canvas_utils import add_video_to_canvas
from services.websocket_service import send_to_websocket
import uuid

async def generate_video_core(
    provider: VideoProviderBase,
    prompt: str,
    model: str,
    duration: float = 5.0,
    aspect_ratio: str = "16:9",
    input_image: str = None,
    canvas_id: str = None,
    session_id: str = None,
) -> str:
    """视频生成核心函数"""

    video_id = str(uuid.uuid4())

    # 发送开始事件
    await send_to_websocket(session_id, {
        'type': 'tool_start',
        'tool_name': 'generate_video',
        'tool_input': {'prompt': prompt}
    })

    try:
        # 调用 Provider 生成视频
        mime_type, video_url = await provider.generate(
            prompt=prompt,
            model=model,
            duration=duration,
            aspect_ratio=aspect_ratio,
            input_image=input_image,
        )

        # 添加视频到画布
        element = await add_video_to_canvas(
            canvas_id=canvas_id,
            video_url=video_url,
        )

        # 发送完成事件
        await send_to_websocket(session_id, {
            'type': 'video_generated',
            'canvas_id': canvas_id,
            'element': element,
            'video_url': video_url
        })

        return f"成功生成视频: {video_url}"

    except Exception as e:
        await send_to_websocket(session_id, {
            'type': 'tool_error',
            'error': str(e)
        })
        raise
```

## ComfyUI 动态工具

### 动态工具构建

```python
# tools/comfy_dynamic.py
from langchain_core.tools import tool
from services.db_service import db_service
from tools.utils.comfyui import submit_comfyui_workflow, wait_for_completion

def build_tool(workflow: dict) -> callable:
    """根据 ComfyUI 工作流构建工具"""

    @tool
    async def comfyui_tool(**kwargs) -> str:
        f"""使用 {workflow['name']} 工作流生成图像"""
        # 构建工作流参数
        workflow_json = workflow['api_json']
        inputs = workflow.get('inputs', {})

        # 替换输入参数
        for key, value in kwargs.items():
            if key in inputs:
                # 设置参数值
                workflow_json = set_workflow_param(workflow_json, key, value)

        # 提交工作流
        prompt_id = await submit_comfyui_workflow(workflow_json)

        # 等待完成
        outputs = await wait_for_completion(prompt_id)

        return f"生成完成: {outputs}"

    return comfyui_tool

async def register_comfy_tools() -> Dict[str, BaseTool]:
    """注册所有 ComfyUI 工作流工具"""
    workflows = await db_service.list_comfy_workflows()
    tools = {}

    for wf in workflows:
        tool_fn = build_tool(wf)
        unique_name = f"comfyui_{wf['name']}"
        tools[unique_name] = tool_fn
        tool_service.register_tool(unique_name, {
            "provider": "comfyui",
            "tool_function": tool_fn,
            "display_name": wf["name"],
            "type": "image",
        })

    return tools
```

## 工具服务初始化

```python
# services/tool_service.py
class ToolService:
    def __init__(self):
        self.tools: Dict[str, ToolInfo] = {}

    async def initialize(self):
        """初始化工具服务"""
        self.clear_tools()

        # 注册系统工具
        self._register_required_tools()

        # 根据配置注册 Provider 工具
        for provider_name, provider_config in config_service.app_config.items():
            if provider_config.get("api_key", ""):
                for tool_id, tool_info in TOOL_MAPPING.items():
                    if tool_info.get("provider") == provider_name:
                        self.register_tool(tool_id, tool_info)

        # 注册 ComfyUI 工作流工具
        if config_service.app_config.get("comfyui", {}).get("url", ""):
            await register_comfy_tools()
```

## 图像处理工具

### 画布工具函数

```python
# tools/utils/image_canvas_utils.py
from typing import Dict, Any
import uuid

async def add_image_to_canvas(
    canvas_id: str,
    filename: str,
    width: int,
    height: int,
) -> Dict[str, Any]:
    """添加图像到画布"""

    # 计算位置
    position = calculate_next_position(canvas_id)

    # 创建图像元素
    element = {
        'id': str(uuid.uuid4()),
        'type': 'image',
        'x': position['x'],
        'y': position['y'],
        'width': width,
        'height': height,
        'fileId': filename,
    }

    return element

def calculate_next_position(canvas_id: str) -> Dict[str, int]:
    """计算下一个图像位置"""
    # 从 localStorage 获取上次位置
    last_position = get_last_image_position()

    if last_position:
        # 在右侧放置
        return {
            'x': last_position['x'] + last_position['width'] + 20,
            'y': last_position['y'],
        }
    else:
        # 默认位置
        return {'x': 100, 'y': 100}
```

## 比例映射

```python
ASPECT_RATIO_MAP = {
    "1:1": (1024, 1024),
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "4:3": (1024, 768),
    "3:4": (768, 1024),
}
```

## 错误处理

```python
async def handle_generation_error(
    error: Exception,
    session_id: str,
    tool_name: str
):
    """处理生成错误"""
    await send_to_websocket(session_id, {
        'type': 'tool_error',
        'tool_name': tool_name,
        'error': str(error)
    })

    # 记录错误日志
    print(f"Error in {tool_name}: {error}")
    traceback.print_exc()
```