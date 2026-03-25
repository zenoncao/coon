// electron/main.js
// npx electron electron/main.js

const fs = require('fs')
const path = require('path')
const os = require('os')
// to import a ts module, we need to import like below
// const gemini = require('./dist/gemin_service')
const logPath = path.join(os.homedir(), 'jaaz-log.txt')
// Check if the log file exists and delete it
if (fs.existsSync(logPath)) {
  fs.unlinkSync(logPath)
}

const logStream = fs.createWriteStream(logPath, { flags: 'a' })

// Redirect all stdout and stderr to the log file
process.stdout.write = process.stderr.write = logStream.write.bind(logStream)

// Optional: Add timestamps to log output
const origLog = console.log
console.log = (...args) => {
  const time = new Date().toISOString()
  origLog(`[${time}]`, ...args)
}

console.error = (...args) => {
  const time = new Date().toISOString()
  origLog(`[${time}][ERROR]`, ...args)
}

// Initial log entry
console.log('🟢 Jaaz Electron app starting...')

const { app, BrowserWindow, ipcMain, dialog, session } = require('electron')
const { spawn } = require('child_process')

const { autoUpdater } = require('electron-updater')

const net = require('net')

// Initialize settings service
const settingsService = require('./settingsService')

function findAvailablePort(startPort, maxAttempts = 100) {
  return new Promise((resolve, reject) => {
    let attempts = 0

    const tryPort = (port) => {
      attempts++
      if (attempts > maxAttempts) {
        reject(new Error(`Could not find available port after ${maxAttempts} attempts`))
        return
      }

      const server = net.createServer()

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${port} is in use, trying next port...`)
          server.close()
          tryPort(port + 1)
        } else {
          reject(err)
        }
      })

      // 明确指定 host 为 127.0.0.1，确保检测到端口占用
      server.listen(port, '127.0.0.1', () => {
        server.close(() => {
          console.log(`Found available port: ${port}`)
          resolve(port)
        })
      })
    }

    tryPort(startPort)
  })
}

let mainWindow
let backendProc = null
let backendPort = null
let childWindows = [] // Track all child windows

// check for updates after the app is ready
// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...')
})

autoUpdater.on('update-available', (info) => {
  console.log('Update available.')
  console.log('Version:', info.version)
  console.log('Release date:', info.releaseDate)
  // Automatically download the update when available
  autoUpdater.downloadUpdate()
})

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info)
})

autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater. ' + err)
})

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = 'Download speed: ' + progressObj.bytesPerSecond
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
  log_message = log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')'
  console.log(log_message)
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('new Jaaz version downloaded:', info.version)

  // send message to renderer process
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info)
  }
})

const createWindow = (backendPort) => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../assets/icons/jaaz.png'), // ✅ Use .png for dev
    autoHideMenuBar: true, // Hide menu bar (can be toggled with Alt key)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // for showing local image and video files
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  })

  // Handle window closed event
  mainWindow.on('closed', () => {
    // Close all child windows
    childWindows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close()
      }
    })
    childWindows = []
    mainWindow = null
  })

  // Handle all navigation requests (intercept all link clicks)
  // 主要用于处理视频链接导致的页面跳转
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    console.log('Navigation requested:', navigationUrl)
    event.preventDefault()

    // Create new window for external links
    const newWindow = new BrowserWindow({
      width: 800,
      height: 600,
      title: 'Jaaz Preview',
      icon: path.join(__dirname, '../assets/icons/jaaz.png'),
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        allowRunningInsecureContent: true,
      },
    })
    newWindow.loadURL(navigationUrl)

    // Add to child windows array
    childWindows.push(newWindow)

    // Handle new window closed event
    newWindow.on('closed', () => {
      // Remove from child windows array
      const index = childWindows.indexOf(newWindow)
      if (index > -1) {
        childWindows.splice(index, 1)
      }
    })
  })

  // In development, use Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5174', {
      extraHeaders: 'pragma: no-cache\n',
    })
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load built files
    mainWindow.loadURL(`http://127.0.0.1:${backendPort}`, {
      extraHeaders: 'pragma: no-cache\n',
    })
  }
}

// 获取 app.asar 内部的根路径
const appRoot = app.getAppPath()

const startNodeApi = async () => {
  // Find an available port
  backendPort = await findAvailablePort(57988)
  console.log('available backendPort:', backendPort)

  // 在某些开发情况，我们希望 node server 独立运行，那么就不通过 electron 启动
  if (process.env.NODE_ENV === 'development') {
    try {
      const response = await fetch(`http://127.0.0.1:${backendPort}`)
      if (response.ok) {
        console.log('Node.js service already running on port:', backendPort)
        return backendPort
      }
    } catch (error) {
      console.log('Starting Node.js service on port:', backendPort)
    }
  } else {
    console.log('Starting Node.js service on port:', backendPort)
  }

  // 确定UI dist目录
  const env = {
    ...process.env,
  }
  env.DEFAULT_PORT = backendPort // 添加端口到环境变量
  if (app.isPackaged) {
    env.UI_DIST_DIR = path.join(process.resourcesPath, 'react', 'dist')
    env.USER_DATA_DIR = app.getPath('userData')
    env.IS_PACKAGED = '1'
  }

  // Set BASE_API_URL based on environment
  env.BASE_API_URL =
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://jaaz.app'
  console.log('BASE_API_URL:', env.BASE_API_URL)

  // Apply proxy settings and get environment variables
  try {
    const proxyEnvVars = await settingsService.getProxyEnvironmentVariables()

    // Merge proxy environment variables into env
    Object.assign(env, proxyEnvVars)
  } catch (error) {
    console.error('Failed to get proxy environment variables:', error)
  }

  // 确定 Node.js 后端目录和启动命令
  const isWindows = process.platform === 'win32'
  const nodeExecutable = process.execPath // 使用 Electron 自带的 Node.js

  // 开发环境：从 server-node 目录启动
  // 生产环境：从打包后的 resources/server-node 启动
  let serverDir
  let startScript

  if (app.isPackaged) {
    serverDir = path.join(process.resourcesPath, 'server-node')
    startScript = path.join(serverDir, 'dist', 'index.js')
  } else {
    serverDir = path.join(__dirname, '../server-node')
    startScript = path.join(serverDir, 'dist', 'index.js')
  }

  console.log('Node.js server directory:', serverDir)
  console.log('Start script:', startScript)
  console.log('Node executable:', nodeExecutable)

  const fs = require('fs')

  // 检查文件是否存在
  const scriptExists = fs.existsSync(startScript)
  console.log('Start script exists?', scriptExists)

  if (!scriptExists) {
    console.error('Error: Node.js server not built. Please run "cd server-node && npm run build" first.')
    throw new Error('Node.js server not built')
  }

  // Start the Node.js process
  backendProc = spawn(
    nodeExecutable,
    [startScript],
    {
      env: env,
      cwd: serverDir
    }
  )

  // Log output to logStream (shared with console.log)
  backendProc.stdout.on('data', (data) => {
    const log = `[${new Date().toISOString()}][NODE stdout] ${data}`
    logStream.write(log)
    process.stdout.write(log) // optional: echo to terminal if running from CLI
  })

  backendProc.stderr.on('data', (data) => {
    const log = `[${new Date().toISOString()}][NODE stderr] ${data}`
    logStream.write(log)
    process.stderr.write(log) // optional: echo to terminal if running from CLI
  })

  // Optional: log if spawn fails
  backendProc.on('error', (err) => {
    const log = `[${new Date().toISOString()}][NODE spawn error] ${err.toString()}\n`
    logStream.write(log)
    process.stderr.write(log)
  })

  // Optional: log process exit
  backendProc.on('exit', (code, signal) => {
    const log = `[${new Date().toISOString()}][NODE exited] code=${code}, signal=${signal}\n`
    logStream.write(log)
  })

  return backendPort
}

// Add these handlers before app.whenReady()
ipcMain.handle('pick-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths
  }
  return null
})

ipcMain.handle('pick-video', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'avi'] }],
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// Add IPC handlers for manual update check
ipcMain.handle('check-for-updates', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify()
    return { message: 'Checking for updates...' }
  } else {
    return { message: 'Auto-updater is disabled in development mode' }
  }
})

// restart and install the new version
ipcMain.handle('restart-and-install', () => {
  autoUpdater.quitAndInstall()
})

const ipcHandlers = require('./ipcHandlers')

for (const [channel, handler] of Object.entries(ipcHandlers)) {
  ipcMain.handle(channel, handler)
}

// Make this app a single instance app
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit()
} else {
  // This is the first instance, set up second-instance handler
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    // Initialize proxy settings for Electron sessions
    try {
      await settingsService.applyProxySettings()
      console.log('Proxy settings applied for Electron sessions')
    } catch (error) {
      console.error('Failed to apply proxy settings for Electron sessions:', error)
    }

    // Check for updates in production every time app starts
    if (process.env.NODE_ENV !== 'development' && app.isPackaged) {
      // Wait a bit for the app to fully load before checking updates
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify()
      }, 3000)
    }

    // Start Node.js API in both development and production
    const backendPort = await startNodeApi()

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // wait for the server to start
      let status = await fetch(`http://127.0.0.1:${backendPort}`)
        .then((res) => {
          return res.ok
        })
        .catch((err) => {
          console.error(err)
          return false
        })
      if (status) {
        break
      }
    }

    createWindow(backendPort)
  })
}

// Quit the app and clean up the Node.js process
app.on('will-quit', async (event) => {
  event.preventDefault()

  try {
    // clear cache
    await session.defaultSession.clearCache()
    console.log('Cache cleared on app exit')
  } catch (error) {
    console.error('Failed to clear cache:', error)
  }

  // kill node.js process
  if (backendProc) {
    backendProc.kill()
    backendProc = null
  }

  app.exit()
})

app.on('window-all-closed', () => {
  app.quit()
})

// ipcMain.handle("reveal-in-explorer", async (event, filePath) => {
//   try {
//     // Convert relative path to absolute path
//     const fullPath = path.join(app.getPath("userData"), "workspace", filePath);

//     // Use shell.openPath which is the recommended way in Electron
//     await shell.showItemInFolder(fullPath);
//     return { success: true };
//   } catch (error) {
//     console.error("Error revealing file:", error);
//     return { error: error.message };
//   }
// });
