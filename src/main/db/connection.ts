// 打开一个SQLite连接：用Node.js内置的 node:sqlite（Electron 43自带的Node运行时已经支持），
// 不引入 better-sqlite3 这类原生模块——原生模块在Electron里需要额外用 electron-rebuild
// 针对Electron自己的Node ABI重新编译，跨环境（本地开发 vs 测试 vs 打包）很容易踩坑；
// node:sqlite是运行时内置的，测试脚本（跑在普通Node上）和Electron主进程用的是同一份实现，不存在ABI不匹配的问题。
import { DatabaseSync } from 'node:sqlite'
import { runMigrations } from './migrations'
import { SCHEMA_SQL } from './schema'

export function openDatabase(filePath: string): DatabaseSync {
  const db = new DatabaseSync(filePath)
  // SQLite默认不启用外键约束检查，必须每个连接单独打开，否则 ON DELETE CASCADE 不会生效
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA_SQL)
  // 表建好之后再补老库缺的列，顺序不能反：新库刚建出来时补丁全都探测到"已经有了"，直接跳过
  runMigrations(db)
  return db
}
