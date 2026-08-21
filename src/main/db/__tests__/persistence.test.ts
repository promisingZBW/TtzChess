// 阶段3验收标准的核心测试：用测试脚本创建一棵棋谱树、持久化，"重启程序"后
// （这里用"关闭连接再用同一个文件路径重新打开"来模拟重启）能重新加载出完整的树结构。

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createChessDatabase, type ChessDatabase } from '../index'
import { STANDARD_START_FEN } from '@shared/chess'

let tempDir: string
let dbFilePath: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'chessoc-db-test-'))
  dbFilePath = join(tempDir, 'chessoc.sqlite3')
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('重启程序后复原棋谱树', () => {
  it('创建一棵带分支和笔记的棋谱树，关闭再重新打开数据库文件，能完整取回', () => {
    // ---------- 第一次"启动程序"：创建数据 ----------
    let db: ChessDatabase = createChessDatabase(dbFilePath)

    const study = db.openingStudies.create({
      pieceType: 'C',
      title: '测试棋路-中炮直车',
      initialFEN: STANDARD_START_FEN
    })

    const move1 = db.moveNodes.create({
      parentId: study.rootNode.id,
      move: '炮二平五',
      moveCoord: 'h2e2',
      boardStateFEN: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b - - 1 1'
    })
    const move2Branch1 = db.moveNodes.create({
      parentId: move1.id,
      move: '马8进7',
      moveCoord: 'b10c8',
      boardStateFEN: 'rnbaka1nr/9/1c2b1c2/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR w - - 2 2'
    })
    const move2Branch2 = db.moveNodes.create({
      parentId: move1.id,
      move: '炮8平5',
      moveCoord: 'h8e8',
      boardStateFEN: 'rnbakabnr/9/4c1c2/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR w - - 2 2'
    })
    db.moveNodes.setNote(move2Branch1.id, '主流应法，稳健应对')

    const studyId = study.id
    const rootId = study.rootNode.id

    db.close()

    // ---------- 模拟"重启程序"：用同一个文件路径重新打开数据库 ----------
    db = createChessDatabase(dbFilePath)

    const reloadedStudy = db.openingStudies.getById(studyId)
    expect(reloadedStudy).not.toBeNull()
    expect(reloadedStudy?.title).toBe('测试棋路-中炮直车')
    expect(reloadedStudy?.pieceType).toBe('C')

    const tree = db.moveNodes.loadSubtree(rootId)
    expect(tree.size).toBe(4) // 根节点 + 3个走法节点

    const reloadedRoot = tree.get(rootId)
    expect(reloadedRoot?.childrenIds).toEqual([move1.id])

    const reloadedMove1 = tree.get(move1.id)
    expect(reloadedMove1?.move).toBe('炮二平五')
    expect(reloadedMove1?.childrenIds.sort()).toEqual([move2Branch1.id, move2Branch2.id].sort())

    const reloadedBranch1 = tree.get(move2Branch1.id)
    expect(reloadedBranch1?.hasNote).toBe(true)
    expect(reloadedBranch1?.note).toBe('主流应法，稳健应对')

    const reloadedBranch2 = tree.get(move2Branch2.id)
    expect(reloadedBranch2?.hasNote).toBe(false)
    expect(reloadedBranch2?.note).toBeNull()

    // 从根到某个分支节点的完整路径也要能正确复原
    const path = db.moveNodes.getPathFromRoot(move2Branch1.id)
    expect(path.map((node) => node.id)).toEqual([rootId, move1.id, move2Branch1.id])
    expect(path.map((node) => node.move)).toEqual(['', '炮二平五', '马8进7'])

    db.close()
  })
})
