# React 前端模块

## 模块概述

React 前端是 Jaaz 的用户界面层，负责渲染画布、聊天界面、设置系统等 UI 组件，并通过 WebSocket 与后端进行实时通信。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | 前端框架 |
| TypeScript | 5.x | 类型安全 |
| TanStack Router | 1.x | 文件系统路由 |
| TanStack Query | 5.x | 数据请求和缓存 |
| Excalidraw | 最新 | 画布组件 |
| Tailwind CSS | 3.x | 样式框架 |
| Shadcn/UI | 最新 | UI 组件库 |
| Socket.IO Client | 4.x | WebSocket 通信 |
| i18next | 最新 | 国际化 |
| Sonner | 最新 | Toast 通知 |

## 项目结构

```
react/src/
├── App.tsx                 # 应用入口
├── main.tsx               # React 渲染入口
├── route-tree.gen.ts      # 自动生成的路由树
├── routes/                # 路由页面
├── components/            # UI 组件
│   ├── canvas/           # 画布组件
│   ├── chat/             # 聊天组件
│   ├── agent_studio/     # 智能体工作室
│   ├── auth/             # 认证组件
│   ├── settings/         # 设置组件
│   ├── common/           # 通用组件
│   └── theme/            # 主题组件
├── contexts/              # React Context
├── api/                   # API 调用模块
├── hooks/                 # 自定义 Hooks
├── types/                 # TypeScript 类型
├── lib/                   # 工具函数
├── i18n/                  # 国际化配置
└── assets/                # 静态资源
```

## 应用入口 (App.tsx)

### 核心架构

```tsx
function App() {
  return (
    <ThemeProvider defaultTheme={theme} storageKey="vite-ui-theme">
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <AuthProvider>
          <ConfigsProvider>
            <div className="app-container">
              <RouterProvider router={router} />

              {/* 全局对话框 */}
              <UpdateNotificationDialog />
              <SettingsDialog />
              <LoginDialog />
            </div>
          </ConfigsProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
      <Toaster position="bottom-center" richColors />
    </ThemeProvider>
  )
}
```

### 提供者层级

```
ThemeProvider          - 主题管理
    └── PersistQueryClientProvider - 数据缓存持久化
        └── AuthProvider          - 用户认证状态
            └── ConfigsProvider   - 应用配置状态
                └── RouterProvider - 路由管理
```

### Query Client 配置

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 分钟
      gcTime: 10 * 60 * 1000,    // 10 分钟
    },
  },
})

// IndexedDB 持久化
const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => {
      const db = await getDB()
      return (await db.get('cache', key)) || null
    },
    setItem: async (key, value) => {
      const db = await getDB()
      await db.put('cache', value, key)
    },
    removeItem: async (key) => {
      const db = await getDB()
      await db.delete('cache', key)
    },
  },
  key: 'react-query-cache',
})
```

## 路由系统

### TanStack Router

使用文件系统路由，路由配置自动生成：

```typescript
// route-tree.gen.ts (自动生成)
export const routeTree = rootRoute.addChildren([
  indexRoute,
  canvasRoute,
  settingsRoute,
])
```

### 路由配置示例

```tsx
// routes/canvas.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/canvas')({
  component: CanvasPage,
  loader: async ({ params }) => {
    return await getCanvasData(params.id)
  },
})
```

## 状态管理

### Context 层级

#### AuthContext - 用户认证

```tsx
// contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (token: string) => Promise<void>
  logout: () => void
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null)

  // 检查登录状态
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetchUserInfo(token).then(setUser)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
```

#### ConfigsProvider - 应用配置

```tsx
// contexts/configs.tsx
export function ConfigsProvider({ children }) {
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
  })

  return (
    <ConfigsContext.Provider value={config}>
      {children}
    </ConfigsContext.Provider>
  )
}
```

#### CanvasContext - 画布状态

```tsx
// contexts/canvas.tsx
export function useCanvas() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)

  return {
    excalidrawAPI,
    setExcalidrawAPI,
  }
}
```

## 画布组件 (Canvas)

### CanvasExcali 组件

基于 Excalidraw 的无限画布组件：

```tsx
const CanvasExcali: React.FC<CanvasExcaliProps> = ({ canvasId, initialData }) => {
  const { excalidrawAPI, setExcalidrawAPI } = useCanvas()
  const { theme } = useTheme()

  // 画布变化处理（防抖保存）
  const handleSave = useDebounce((elements, appState, files) => {
    const data: CanvasData = { elements, appState, files }
    saveCanvas(canvasId, { data, thumbnail })
  }, 1000)

  // 添加图像到画布
  const addImageToExcalidraw = useCallback(async (imageElement, file) => {
    excalidrawAPI.addFiles([file])
    excalidrawAPI.updateScene({
      elements: [...currentElements, imageElement],
    })
  }, [excalidrawAPI])

  // 监听 WebSocket 事件
  useEffect(() => {
    eventBus.on('Socket::Session::ImageGenerated', handleImageGenerated)
    eventBus.on('Socket::Session::VideoGenerated', handleVideoGenerated)
    return () => {
      eventBus.off('Socket::Session::ImageGenerated', handleImageGenerated)
      eventBus.off('Socket::Session::VideoGenerated', handleVideoGenerated)
    }
  }, [])

  return (
    <Excalidraw
      theme={theme === 'dark' ? 'light' : theme}
      excalidrawAPI={setExcalidrawAPI}
      onChange={handleSave}
      initialData={initialData}
      renderEmbeddable={renderEmbeddable}
      validateEmbeddable={() => true}
    />
  )
}
```

### 深色模式处理

Excalidraw 默认不支持深色模式，通过自定义方案实现：

```tsx
// 使用 light 主题但自定义背景色
const customTheme = theme === 'dark' ? 'light' : theme

useEffect(() => {
  if (excalidrawAPI && theme === 'dark') {
    excalidrawAPI.updateScene({
      appState: {
        viewBackgroundColor: '#121212',
        gridColor: 'rgba(255, 255, 255, 0.1)',
      }
    })
  }
}, [excalidrawAPI, theme])
```

### 视频元素渲染

自定义渲染嵌入的视频元素：

```tsx
const renderEmbeddable = useCallback((element, appState) => {
  const { link } = element

  if (link && (link.includes('.mp4') || link.includes('.webm') || link.startsWith('blob:'))) {
    return <VideoElement src={link} width={element.width} height={element.height} />
  }

  return null
}, [])
```

## 聊天组件 (Chat)

### 核心功能

- 消息发送和接收
- 流式响应显示
- 工具调用展示
- 图像/视频预览

### 消息处理流程

```
用户输入消息
    │
    ▼
发送到后端 (POST /api/chat)
    │
    │ WebSocket session_update 事件
    ▼
接收流式响应
    │
    ▼
更新消息列表
    │
    ▼
检测到图像/视频生成
    │
    ▼
触发 Canvas 更新
```

## 设置系统

### 设置对话框

```tsx
// components/settings/dialog.tsx
export function SettingsDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">通用</TabsTrigger>
            <TabsTrigger value="models">模型</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralSettings />
          </TabsContent>
          <TabsContent value="models">
            <ModelSettings />
          </TabsContent>
          <TabsContent value="api">
            <ApiSettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

### 配置持久化

设置通过后端 API 保存到本地配置文件：

```typescript
// api/settings.ts
export async function updateSettings(settings: Settings) {
  const response = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  return response.json()
}
```

## 主题系统

### ThemeProvider

```tsx
// components/theme/ThemeProvider.tsx
export function ThemeProvider({ defaultTheme, storageKey, children }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(storageKey)
    return (stored as Theme) || defaultTheme
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

### 主题切换 Hook

```tsx
// hooks/use-theme.ts
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
```

## API 模块

### 模块结构

```
api/
├── auth.ts       # 认证相关
├── canvas.ts     # 画布操作
├── chat.ts       # 聊天消息
├── config.ts     # 配置管理
├── model.ts      # 模型管理
├── settings.ts   # 设置管理
├── upload.ts     # 文件上传
└── magic.ts      # 魔法功能
```

### API 调用示例

```typescript
// api/chat.ts
export async function sendMessage(data: ChatRequest) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function cancelChat(sessionId: string) {
  const response = await fetch(`/api/cancel/${sessionId}`, {
    method: 'POST',
  })
  return response.json()
}
```

## WebSocket 集成

### Socket.IO 连接

```tsx
// lib/socket.ts
import { io } from 'socket.io-client'

const socket = io('http://127.0.0.1:57988', {
  path: '/socket.io',
  transports: ['websocket'],
})

socket.on('connect', () => {
  console.log('WebSocket connected')
})

socket.on('session_update', (data) => {
  eventBus.emit('Socket::Session::Update', data)
})

socket.on('init_done', () => {
  eventBus.emit('Socket::InitDone')
})
```

### EventBus 事件分发

```tsx
// lib/event.ts
class EventBus {
  private listeners: Map<string, Set<Function>> = new Map()

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback)
  }

  emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(cb => cb(data))
  }
}

export const eventBus = new EventBus()
```

## 国际化

### i18next 配置

```tsx
// i18n/index.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: require('./locales/en.json') },
      zh: { translation: require('./locales/zh.json') },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
```

### 使用示例

```tsx
import { useTranslation } from 'react-i18next'

function Component() {
  const { t, i18n } = useTranslation()

  return (
    <div>
      <h1>{t('welcome')}</h1>
      <button onClick={() => i18n.changeLanguage('zh')}>
        切换中文
      </button>
    </div>
  )
}
```

## 自定义 Hooks

### useDebounce

```tsx
// hooks/use-debounce.ts
export default function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay)
  }, [callback, delay]) as T
}
```

### useTheme

```tsx
// hooks/use-theme.ts
export function useTheme() {
  const { theme } = useContext(ThemeContext)
  return { theme }
}
```

## 构建配置

### Vite 配置

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), TanStackRouterVite()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5174,
  },
})
```

### TypeScript 配置

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```