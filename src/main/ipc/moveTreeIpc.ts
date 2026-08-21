// 把渲染进程发过来的棋谱树读写请求，转发给阶段3做好的数据库仓库层。
// 这一层不包含任何业务逻辑，只是"IPC channel名 -> 调用哪个仓库方法"的映射表。

import { ipcMain } from 'electron'
import { EMPTY_BOARD_FEN, STANDARD_START_FEN } from '@shared/chess'
import {
  MOVE_TREE_CHANNELS,
  type CreateFolderRequest,
  type CreateMoveNodeRequest,
  type CreateOpeningStudyRequest,
  type CreateStudyCaseRequest
} from '@shared/ipc'
import type { ChessDatabase } from '../db'

export function registerMoveTreeIpc(db: ChessDatabase): void {
  ipcMain.handle(MOVE_TREE_CHANNELS.createOpeningStudy, (_event, input: CreateOpeningStudyRequest) =>
    db.openingStudies.create({
      pieceType: input.pieceType,
      title: input.title,
      initialFEN: STANDARD_START_FEN // 开局棋路永远从标准开局起始局面开始
    })
  )
  ipcMain.handle(MOVE_TREE_CHANNELS.listOpeningStudies, () => db.openingStudies.listAll())
  ipcMain.handle(MOVE_TREE_CHANNELS.getOpeningStudy, (_event, id: string) => db.openingStudies.getById(id))
  ipcMain.handle(MOVE_TREE_CHANNELS.touchOpeningStudy, (_event, id: string) => {
    db.openingStudies.touchUpdatedAt(id)
  })

  ipcMain.handle(MOVE_TREE_CHANNELS.createStudyCase, (_event, input: CreateStudyCaseRequest) =>
    db.studyCases.create({
      type: input.type,
      title: input.title,
      folderId: input.folderId ?? null,
      initialFEN: EMPTY_BOARD_FEN // 中局/终局案例从空白棋盘开始，用户自己摆局
    })
  )
  ipcMain.handle(MOVE_TREE_CHANNELS.listStudyCases, () => db.studyCases.listAll())
  ipcMain.handle(MOVE_TREE_CHANNELS.getStudyCase, (_event, id: string) => db.studyCases.getById(id))
  ipcMain.handle(MOVE_TREE_CHANNELS.touchStudyCase, (_event, id: string) => {
    db.studyCases.touchUpdatedAt(id)
  })

  ipcMain.handle(MOVE_TREE_CHANNELS.loadTree, (_event, rootNodeId: string) =>
    Array.from(db.moveNodes.loadSubtree(rootNodeId).values())
  )
  ipcMain.handle(MOVE_TREE_CHANNELS.createMoveNode, (_event, input: CreateMoveNodeRequest) =>
    db.moveNodes.create(input)
  )
  ipcMain.handle(MOVE_TREE_CHANNELS.setNote, (_event, nodeId: string, note: string | null) =>
    db.moveNodes.setNote(nodeId, note)
  )
  ipcMain.handle(MOVE_TREE_CHANNELS.updateBoardState, (_event, nodeId: string, boardStateFEN: string) =>
    db.moveNodes.updateBoardState(nodeId, boardStateFEN)
  )

  // 阶段5：案例库的文件夹管理 + 案例搜索/分类/改名/删除
  ipcMain.handle(MOVE_TREE_CHANNELS.createFolder, (_event, input: CreateFolderRequest) =>
    db.folders.create(input.name, input.parentFolderId ?? null)
  )
  ipcMain.handle(MOVE_TREE_CHANNELS.listFolders, (_event, parentFolderId: string | null) =>
    db.folders.listChildren(parentFolderId)
  )
  ipcMain.handle(MOVE_TREE_CHANNELS.listAllFolders, () => db.folders.listAll())
  ipcMain.handle(MOVE_TREE_CHANNELS.renameFolder, (_event, id: string, name: string) =>
    db.folders.rename(id, name)
  )
  ipcMain.handle(MOVE_TREE_CHANNELS.deleteFolder, (_event, id: string) => {
    db.folders.delete(id)
  })

  ipcMain.handle(MOVE_TREE_CHANNELS.listStudyCasesByFolder, (_event, folderId: string | null) =>
    db.studyCases.listByFolder(folderId)
  )
  ipcMain.handle(MOVE_TREE_CHANNELS.searchStudyCases, (_event, keyword: string) =>
    db.studyCases.searchByTitle(keyword)
  )
  ipcMain.handle(MOVE_TREE_CHANNELS.renameStudyCase, (_event, id: string, title: string) =>
    db.studyCases.rename(id, title)
  )
  ipcMain.handle(MOVE_TREE_CHANNELS.moveStudyCaseToFolder, (_event, id: string, folderId: string | null) =>
    db.studyCases.moveToFolder(id, folderId)
  )
  ipcMain.handle(MOVE_TREE_CHANNELS.deleteStudyCase, (_event, id: string) => {
    db.studyCases.delete(id)
  })
}
