import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { openAppDatabase } from './db/appDatabase'
import type { ChessDatabase } from './db'

// 阶段3只要求数据库层能跑通增删改查+持久化，IPC桥接（渲染进程读写棋谱树）留到阶段4接入
// 打谱详情界面时再做，这里先在应用生命周期里正确打开/关闭数据库连接，验证它在真实Electron
// 环境（而不只是vitest的Node环境）下也能正常工作。
let chessDatabase: ChessDatabase | null = null

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

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
