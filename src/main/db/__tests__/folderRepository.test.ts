import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createChessDatabase, type ChessDatabase } from '../index'

let db: ChessDatabase

beforeEach(() => {
  db = createChessDatabase(':memory:')
})

afterEach(() => {
  db.close()
})

describe('FolderRepository', () => {
  it('支持创建嵌套文件夹，并按parentFolderId查询子文件夹', () => {
    const root = db.folders.create('残局案例库')
    const child = db.folders.create('单车残局', root.id)

    expect(db.folders.listChildren(null).map((f) => f.id)).toContain(root.id)
    expect(db.folders.listChildren(root.id).map((f) => f.id)).toEqual([child.id])
  })

  it('rename 更新文件夹名称', () => {
    const folder = db.folders.create('旧名字')
    const renamed = db.folders.rename(folder.id, '新名字')
    expect(renamed?.name).toBe('新名字')
  })

  it('删除父文件夹后，子文件夹变成顶层文件夹（不会被连带删除）', () => {
    const root = db.folders.create('父文件夹')
    const child = db.folders.create('子文件夹', root.id)

    db.folders.delete(root.id)

    expect(db.folders.getById(root.id)).toBeNull()
    const reloadedChild = db.folders.getById(child.id)
    expect(reloadedChild).not.toBeNull()
    expect(reloadedChild?.parentFolderId).toBeNull()
  })

  it('listAll 不分层级，返回数据库里的全部文件夹（阶段5"移动到"下拉框拼路径名用）', () => {
    const root = db.folders.create('残局案例库')
    const child = db.folders.create('单车残局', root.id)
    const another = db.folders.create('中局战术')

    const all = db.folders.listAll().map((f) => f.id)
    expect(all).toEqual(expect.arrayContaining([root.id, child.id, another.id]))
    expect(all).toHaveLength(3)
  })

  it('删除文件夹后，里面的案例变成未分类（folderId变null），不会被连带删除', () => {
    const folder = db.folders.create('待删除的文件夹')
    const studyCase = db.studyCases.create({
      type: 'midgame',
      title: '案例',
      folderId: folder.id,
      initialFEN: 'fen'
    })

    db.folders.delete(folder.id)

    const reloadedCase = db.studyCases.getById(studyCase.id)
    expect(reloadedCase).not.toBeNull()
    expect(reloadedCase?.folderId).toBeNull()
  })
})
