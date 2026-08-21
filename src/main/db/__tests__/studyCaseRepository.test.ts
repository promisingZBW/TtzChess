import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createChessDatabase, type ChessDatabase } from '../index'

let db: ChessDatabase

beforeEach(() => {
  db = createChessDatabase(':memory:')
})

afterEach(() => {
  db.close()
})

describe('StudyCaseRepository', () => {
  it('创建案例时可以指定文件夹，也可以不分类(folderId为null)', () => {
    const folder = db.folders.create('经典残局')
    const inFolder = db.studyCases.create({
      type: 'endgame',
      title: '车马冷着',
      folderId: folder.id,
      initialFEN: 'fen'
    })
    const unfiled = db.studyCases.create({ type: 'midgame', title: '未分类中局', initialFEN: 'fen' })

    expect(inFolder.folderId).toBe(folder.id)
    expect(unfiled.folderId).toBeNull()

    expect(db.studyCases.listByFolder(folder.id).map((c) => c.id)).toEqual([inFolder.id])
    expect(db.studyCases.listByFolder(null).map((c) => c.id)).toEqual([unfiled.id])
  })

  it('searchByTitle 能按标题关键字模糊搜索', () => {
    db.studyCases.create({ type: 'endgame', title: '车马冷着实战', initialFEN: 'fen' })
    db.studyCases.create({ type: 'endgame', title: '单车必胜士象全', initialFEN: 'fen' })

    const results = db.studyCases.searchByTitle('冷着')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('车马冷着实战')
  })

  it('moveToFolder 可以把案例移动到另一个文件夹，或移出变成未分类', () => {
    const folderA = db.folders.create('文件夹A')
    const folderB = db.folders.create('文件夹B')
    const studyCase = db.studyCases.create({
      type: 'midgame',
      title: '中局案例',
      folderId: folderA.id,
      initialFEN: 'fen'
    })

    const moved = db.studyCases.moveToFolder(studyCase.id, folderB.id)
    expect(moved?.folderId).toBe(folderB.id)

    const unfiled = db.studyCases.moveToFolder(studyCase.id, null)
    expect(unfiled?.folderId).toBeNull()
  })

  it('delete 删除案例时，连带把整棵棋谱树也删掉', () => {
    const studyCase = db.studyCases.create({ type: 'endgame', title: '残局案例', initialFEN: 'fen' })
    const child = db.moveNodes.create({
      parentId: studyCase.rootNode.id,
      move: '车二进一',
      moveCoord: 'a1a2',
      boardStateFEN: 'fen2'
    })

    db.studyCases.delete(studyCase.id)

    expect(db.studyCases.getById(studyCase.id)).toBeNull()
    expect(db.moveNodes.getById(studyCase.rootNode.id)).toBeNull()
    expect(db.moveNodes.getById(child.id)).toBeNull()
  })
})
