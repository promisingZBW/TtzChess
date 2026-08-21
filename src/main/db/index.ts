// 数据库模块的统一入口：createChessDatabase(filePath) 打开一个连接，返回四个仓库
// （棋谱树节点/开局棋路/中局终局案例/文件夹）绑定在同一个连接上，外部代码不需要
// 关心这四张表内部是怎么关联的，直接调用对应仓库的方法即可。

import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from './connection'
import { MoveNodeRepository } from './moveNodeRepository'
import { OpeningStudyRepository } from './openingStudyRepository'
import { StudyCaseRepository } from './studyCaseRepository'
import { FolderRepository } from './folderRepository'

export * from './moveNodeRepository'
export * from './openingStudyRepository'
export * from './studyCaseRepository'
export * from './folderRepository'

export interface ChessDatabase {
  /** 极少数场景（比如手写迁移脚本）需要直接操作连接，正常业务代码不应该用到这个 */
  raw: DatabaseSync
  moveNodes: MoveNodeRepository
  openingStudies: OpeningStudyRepository
  studyCases: StudyCaseRepository
  folders: FolderRepository
  close: () => void
}

export function createChessDatabase(filePath: string): ChessDatabase {
  const db = openDatabase(filePath)
  return {
    raw: db,
    moveNodes: new MoveNodeRepository(db),
    openingStudies: new OpeningStudyRepository(db),
    studyCases: new StudyCaseRepository(db),
    folders: new FolderRepository(db),
    close: () => db.close()
  }
}
