import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createChessDatabase, type ChessDatabase } from '../index'

let db: ChessDatabase

beforeEach(() => {
  db = createChessDatabase(':memory:')
})

afterEach(() => {
  db.close()
})

describe('OpeningStudyRepository', () => {
  it('创建棋路时会自动生成一个空白的根节点', () => {
    const study = db.openingStudies.create({
      pieceType: 'N',
      title: '起马局-对兵局',
      initialFEN: 'start-fen'
    })
    expect(study.rootNode.parentId).toBeNull()
    expect(study.rootNode.boardStateFEN).toBe('start-fen')
    expect(study.rootNode.childrenIds).toEqual([])
  })

  it('同一个中心点(pieceType)下可以创建多条互相独立的棋路', () => {
    const studyA = db.openingStudies.create({ pieceType: 'N', title: '起马局-对兵局', initialFEN: 'fen' })
    const studyB = db.openingStudies.create({ pieceType: 'N', title: '起马局-左炮封车', initialFEN: 'fen' })
    expect(studyA.rootNode.id).not.toBe(studyB.rootNode.id) // 各自独立的棋谱树，不共享根节点

    const list = db.openingStudies.listByPieceType('N')
    expect(list.map((s) => s.id).sort()).toEqual([studyA.id, studyB.id].sort())
  })

  it('listOpeningRoots 按棋子类型分组，且带上中心点的显示名', () => {
    db.openingStudies.create({ pieceType: 'N', title: '起马局-对兵局', initialFEN: 'fen' })
    db.openingStudies.create({ pieceType: 'N', title: '起马局-左炮封车', initialFEN: 'fen' })
    db.openingStudies.create({ pieceType: 'C', title: '中炮直车', initialFEN: 'fen' })

    const roots = db.openingStudies.listOpeningRoots()
    const nRoot = roots.find((r) => r.pieceType === 'N')
    const cRoot = roots.find((r) => r.pieceType === 'C')

    expect(nRoot?.studyIds).toHaveLength(2)
    expect(nRoot?.centerLabel).toBe('起马局')
    expect(cRoot?.studyIds).toHaveLength(1)
    expect(cRoot?.centerLabel).toBe('当头炮局')
  })

  it('rename 更新标题的同时会刷新 updatedAt', async () => {
    const study = db.openingStudies.create({ pieceType: 'R', title: '旧标题', initialFEN: 'fen' })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const renamed = db.openingStudies.rename(study.id, '新标题')
    expect(renamed?.title).toBe('新标题')
    expect(renamed!.updatedAt).toBeGreaterThan(study.updatedAt)
  })

  it('delete 删除棋路时，连带把整棵棋谱树也删掉', () => {
    const study = db.openingStudies.create({ pieceType: 'P', title: '挺兵局研究', initialFEN: 'fen' })
    const child = db.moveNodes.create({
      parentId: study.rootNode.id,
      move: '兵三进一',
      moveCoord: 'a4a5',
      boardStateFEN: 'fen2'
    })

    db.openingStudies.delete(study.id)

    expect(db.openingStudies.getById(study.id)).toBeNull()
    expect(db.moveNodes.getById(study.rootNode.id)).toBeNull()
    expect(db.moveNodes.getById(child.id)).toBeNull()
  })
})
