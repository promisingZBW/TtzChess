// 真正在Electron里跑起来时，数据库文件应该放在哪：用Electron提供的用户数据目录
// （Windows下大概是 %APPDATA%/ChessOC），而不是硬编码或者放进项目目录里，
// 这样打包后的正式安装版也能正常读写数据。
//
// 这个文件只在main进程的入口(index.ts)里用一次；测试脚本不应该依赖它，
// 而是直接调用 createChessDatabase(自定义路径) ——这也是为什么数据库核心逻辑
// (schema/connection/各个repository)都不直接依赖 electron 模块，保持可以脱离Electron单独测试。
import { app } from 'electron'
import { join } from 'node:path'
import { createChessDatabase, type ChessDatabase } from './index'

const DB_FILE_NAME = 'chessoc.sqlite3'

export function openAppDatabase(): ChessDatabase {
  const filePath = join(app.getPath('userData'), DB_FILE_NAME)
  return createChessDatabase(filePath)
}
