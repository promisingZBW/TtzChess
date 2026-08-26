// 棋路数据放在应用根目录下的 data/ 里，不放 %APPDATA%。
// 开发时是项目根目录/data；打包后是 TtzChess.exe 旁边的 data。
// 用户把整个 data 文件夹拷到另一台电脑的同位置，替换即可同步全部棋路。
//
// 这个文件只在main进程的入口(index.ts)里用一次；测试脚本不应该依赖它，
// 而是直接调用 createChessDatabase(自定义路径) ——这也是为什么数据库核心逻辑
// (schema/connection/各个repository)都不直接依赖 electron 模块，保持可以脱离Electron单独测试。
import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createChessDatabase, type ChessDatabase } from './index'

const DB_FILE_NAME = 'ttzchess.sqlite3'

export function resolveStudyDataDir(): string {
  const appRoot = app.isPackaged ? dirname(app.getPath('exe')) : app.getAppPath()
  return join(appRoot, 'data')
}

export function openAppDatabase(): ChessDatabase {
  const dir = resolveStudyDataDir()
  mkdirSync(dir, { recursive: true })
  return createChessDatabase(join(dir, DB_FILE_NAME))
}
