import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { openAppDatabase } from './db/appDatabase'
import { registerMoveTreeIpc } from './ipc/moveTreeIpc'
import { registerEngineIpc } from './ipc/engineIpc'
import { createAppEngineService } from './engine/appEngine'
import type { ChessDatabase } from './db'
import type { EngineService } from './engine'

let chessDatabase: ChessDatabase | null = null
let engineService: EngineService | null = null

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'ChessOC',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 应用内不需要跳出新窗口，外链统一交给系统默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    // 开发模式：连接 Vite dev server，支持渲染进程热更新
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // 生产模式：加载打包后的静态文件
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  chessDatabase = openAppDatabase()
  registerMoveTreeIpc(chessDatabase)

  // 引擎二进制是"按需存在"的（见 resources/engines/README.md，不随git提交），
  // 就算一个都没装，EngineService也能正常构造，只是状态是'unavailable'、
  // analyzePosition会抛出明确的错误提示，不会导致应用启动失败或崩溃
  engineService = createAppEngineService()
  registerEngineIpc(engineService)

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  chessDatabase?.close()
  chessDatabase = null

  // 显式kill掉引擎子进程，避免应用退出后留下孤儿进程还占着CPU
  engineService?.dispose()
  engineService = null

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
