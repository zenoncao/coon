# Electron 主进程模块

## 模块概述

Electron 主进程是 Jaaz 桌面应用的核心，负责应用生命周期管理、窗口创建、Python 服务启动、IPC 通信和自动更新等功能。

## 主要文件

| 文件 | 功能 |
|------|------|
| `electron/main.js` | 应用入口，窗口管理，Python 服务启动 |
| `electron/preload.js` | 预加载脚本，暴露 IPC 接口给渲染进程 |
| `electron/ipcHandlers.js` | IPC 处理器，处理渲染进程请求 |
| `electron/comfyUIInstaller.js` | ComfyUI 安装逻辑 |
| `electron/comfyUIManager.js` | ComfyUI 进程管理 |
| `electron/settingsService.js` | 代理和系统设置服务 |

## 应用入口 (main.js)

### 启动流程

```javascript
// 1. 初始化日志系统
const logPath = path.join(os.homedir(), 'jaaz-log.txt')
const logStream = fs.createWriteStream(logPath, { flags: 'a' })
process.stdout.write = process.stderr.write = logStream.write.bind(logStream)

// 2. 等待应用就绪
app.whenReady().then(async () => {
  // 3. 应用代理设置
  await settingsService.applyProxySettings()

  // 4. 检查更新（生产环境）
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify()
  }

  // 5. 启动 Python 后端服务
  const pyPort = await startPythonApi()

  // 6. 等待 Python 服务就绪
  await waitForServerReady(pyPort)

  // 7. 创建主窗口
  createWindow(pyPort)
})
```

### 窗口管理

```javascript
function createWindow(pyPort) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../assets/icons/jaaz.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,      // 启用上下文隔离
      nodeIntegration: false,       // 禁用 Node.js 集成
      webSecurity: false,           // 允许加载本地文件
    },
  })

  // 开发模式：加载 Vite 开发服务器
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5174')
    mainWindow.webContents.openDevTools()
  } else {
    // 生产模式：加载 Python 服务提供的页面
    mainWindow.loadURL(`http://127.0.0.1:${pyPort}`)
  }
}
```

### 端口查找机制

应用启动时动态查找可用端口：

```javascript
async function findAvailablePort(startPort, maxAttempts = 100) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = net.createServer()
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(port))
      })
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          tryPort(port + 1)  // 端口被占用，尝试下一个
        }
      })
    }
    tryPort(startPort)
  })
}
```

## Python 服务管理

### 启动 Python 服务

```javascript
async function startPythonApi() {
  // 1. 查找可用端口
  pyPort = await findAvailablePort(57988)

  // 2. 配置环境变量
  const env = {
    ...process.env,
    PYTHONIOENCODING: 'utf-8',
    DEFAULT_PORT: pyPort,
  }

  // 3. 生产环境配置
  if (app.isPackaged) {
    env.UI_DIST_DIR = path.join(process.resourcesPath, 'react', 'dist')
    env.USER_DATA_DIR = app.getPath('userData')
    env.IS_PACKAGED = '1'
  }

  // 4. 确定 Python 可执行文件路径
  const pythonExecutable = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'dist', 'main', 'main')
    : 'python'

  // 5. 启动进程
  pyProc = spawn(pythonExecutable, [`--port`, pyPort], { env })

  // 6. 日志输出处理
  pyProc.stdout.on('data', (data) => {
    logStream.write(`[${new Date().toISOString()}][PYTHON] ${data}`)
  })

  return pyPort
}
```

### 进程生命周期管理

```javascript
// 应用退出时清理
app.on('will-quit', async (event) => {
  event.preventDefault()

  // 清理缓存
  await session.defaultSession.clearCache()

  // 终止 Python 进程
  if (pyProc) {
    pyProc.kill()
    pyProc = null
  }

  app.exit()
})

// 单实例锁定
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()  // 已有实例运行，退出
}
```

## IPC 通信机制

### 预加载脚本 (preload.js)

预加载脚本通过 `contextBridge` 安全地暴露 API 给渲染进程：

```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件选择
  pickImage: () => ipcRenderer.invoke('pick-image'),
  pickVideo: () => ipcRenderer.invoke('pick-video'),

  // ComfyUI 管理
  installComfyUI: () => ipcRenderer.invoke('install-comfyui'),
  uninstallComfyUI: () => ipcRenderer.invoke('uninstall-comfyui'),
  startComfyUIProcess: () => ipcRenderer.invoke('start-comfyui-process'),
  stopComfyUIProcess: () => ipcRenderer.invoke('stop-comfyui-process'),

  // 自动更新
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  restartAndInstall: () => ipcRenderer.invoke('restart-and-install'),
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info))
  },
})
```

### IPC 处理器 (ipcHandlers.js)

```javascript
module.exports = {
  // 打开外部链接
  'open-browser-url': async (event, url) => {
    await shell.openExternal(url)
    return { success: true }
  },

  // 检查 ComfyUI 安装状态
  'check-comfyui-installed': async (event) => {
    const { isComfyUIInstalled } = require('./comfyUIManager')
    return isComfyUIInstalled()
  },

  // 启动 ComfyUI 进程
  'start-comfyui-process': async (event) => {
    const { startComfyUIProcess } = require('./comfyUIManager')
    return await startComfyUIProcess()
  },
}
```

## 自动更新机制

### 配置

```json
// package.json
{
  "build": {
    "publish": {
      "provider": "github",
      "releaseType": "draft"
    }
  }
}
```

### 更新流程

```javascript
const { autoUpdater } = require('electron-updater')

// 检查更新
autoUpdater.on('update-available', (info) => {
  console.log('发现新版本:', info.version)
  autoUpdater.downloadUpdate()
})

// 下载进度
autoUpdater.on('download-progress', (progressObj) => {
  console.log(`下载进度: ${progressObj.percent}%`)
})

// 更新就绪
autoUpdater.on('update-downloaded', (info) => {
  // 通知渲染进程
  mainWindow.webContents.send('update-downloaded', info)
})

// 重启并安装
ipcMain.handle('restart-and-install', () => {
  autoUpdater.quitAndInstall()
})
```

## ComfyUI 集成

### 安装管理

ComfyUI 安装在用户数据目录下的 `comfyui` 文件夹中：

```
用户数据目录/
├── comfyui/
│   ├── ComfyUI/           # ComfyUI 主程序
│   ├── python_embeded/    # 嵌入式 Python
│   └── models/            # 模型文件
└── localmanus.db          # 应用数据库
```

### 进程管理

```javascript
// comfyUIManager.js
let comfyUIProcess = null

async function startComfyUIProcess() {
  if (comfyUIProcess) {
    return { success: false, message: 'ComfyUI already running' }
  }

  const comfyUIPath = path.join(userDataDir, 'comfyui', 'ComfyUI')
  const pythonPath = path.join(userDataDir, 'comfyui', 'python_embeded', 'python')

  comfyUIProcess = spawn(pythonPath, [
    'main.py',
    '--port', '8188',
    '--listen', '127.0.0.1'
  ], { cwd: comfyUIPath })

  return { success: true, message: 'ComfyUI started' }
}

function stopComfyUIProcess() {
  if (comfyUIProcess) {
    comfyUIProcess.kill()
    comfyUIProcess = null
    return { success: true }
  }
  return { success: false, message: 'ComfyUI not running' }
}
```

## 日志系统

所有日志写入用户主目录下的 `jaaz-log.txt` 文件：

```javascript
const logPath = path.join(os.homedir(), 'jaaz-log.txt')
const logStream = fs.createWriteStream(logPath, { flags: 'a' })

// 重定向控制台输出
process.stdout.write = process.stderr.write = logStream.write.bind(logStream)

// 添加时间戳
console.log = (...args) => {
  origLog(`[${new Date().toISOString()}]`, ...args)
}
```

## 窗口导航处理

处理外部链接和视频链接的导航：

```javascript
mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
  event.preventDefault()  // 阻止默认导航

  // 在新窗口打开
  const newWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Jaaz Preview',
  })
  newWindow.loadURL(navigationUrl)
  childWindows.push(newWindow)
})
```

## 关键配置

### 安全配置

```javascript
webPreferences: {
  contextIsolation: true,     // 启用上下文隔离
  nodeIntegration: false,      // 禁用 Node.js 集成
  webSecurity: false,          // 允许加载本地文件
  allowRunningInsecureContent: true,
}
```

### macOS 特定配置

```json
{
  "mac": {
    "category": "public.app-category.utilities",
    "icon": "assets/icons/jaaz.icns",
    "target": ["dmg", "zip"],
    "gatekeeperAssess": false,
    "hardenedRuntime": true,
    "entitlements": "entitlements.mac.plist",
    "notarize": false
  }
}
```

## 调试与开发

### 开发模式

```bash
# 启动 React 开发服务器
cd react && npm run dev

# 启动 Electron 开发模式
NODE_ENV=development npx electron electron/main.js
```

### 查看日志

```bash
# macOS/Linux
cat ~/jaaz-log.txt

# Windows
type %USERPROFILE%\jaaz-log.txt
```