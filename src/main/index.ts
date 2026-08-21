import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { openAppDatabase } from './db/appDatabase'
import { registerMoveTreeIpc } from './ipc/moveTreeIpc'
import type { ChessDatabase } from './db'

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
  registerMoveTreeIpc(chessDatabase)

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
