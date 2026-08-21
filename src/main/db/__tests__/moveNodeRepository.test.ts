import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createChessDatabase, type ChessDatabase } from '../index'

let db: ChessDatabase

beforeEach(() => {
  db = createChessDatabase(':memory:')
})

afterEach(() => {
  db.close()
})

function createRoot(): ReturnType<ChessDatabase['moveNodes']['create']> {
  return db.moveNodes.create({ parentId: null, move: '', moveCoord: '', boardStateFEN: 'start-fen' })
}

describe('MoveNodeRepository 基础增删改查', () => {
  it('创建节点后能按id查回，且新节点默认没有子节点、没有笔记', () => {
    const node = createRoot()
    const loaded = db.moveNodes.getById(node.id)
    expect(loaded).toEqual(node)
    expect(loaded?.childrenIds).toEqual([])
    expect(loaded?.hasNote).toBe(false)
    expect(loaded?.note).toBeNull()
  })

  it('父节点创建子节点后，父节点的childrenIds要能查到这个子节点', () => {
    const root = createRoot()
    const child = db.moveNodes.create({
      parentId: root.id,
      move: '炮二平五',
      moveCoord: 'h2e2',
      boardStateFEN: 'fen-after-move-1'
    })
    const reloadedRoot = db.moveNodes.getById(root.id)
    expect(reloadedRoot?.childrenIds).toEqual([child.id])
    expect(child.parentId).toBe(root.id)
  })

  it('setNote 设置笔记后 hasNote 变true，传null清空后变回false', () => {
    const node = createRoot()
    const withNote = db.moveNodes.setNote(node.id, '这里是笔记内容')
    expect(withNote?.hasNote).toBe(true)
    expect(withNote?.note).toBe('这里是笔记内容')

    const cleared = db.moveNodes.setNote(node.id, null)
    expect(cleared?.hasNote).toBe(false)
    expect(cleared?.note).toBeNull()
  })

  it('getPathFromRoot 对根节点自己应该只返回一个元素', () => {
    const root = createRoot()
    const path = db.moveNodes.getPathFromRoot(root.id)
    expect(path).toHaveLength(1)
    expect(path[0].id).toBe(root.id)
  })

  it('deleteSubtree 删除某个节点会级联删掉它底下的所有子孙节点，但不影响兄弟节点', () => {
    const root = createRoot()
    const child1 = db.moveNodes.create({
      parentId: root.id,
      move: '炮二平五',
      moveCoord: 'h2e2',
      boardStateFEN: 'fen-1'
    })
    const child2 = db.moveNodes.create({
      parentId: root.id,
      move: '马二进三',
      moveCoord: 'h1g3',
      boardStateFEN: 'fen-2'
    })
    const grandchild = db.moveNodes.create({
      parentId: child1.id,
      move: '马8进7',
      moveCoord: 'b10c8',
      boardStateFEN: 'fen-1-1'
    })

    db.moveNodes.deleteSubtree(child1.id)

    expect(db.moveNodes.getById(child1.id)).toBeNull()
    expect(db.moveNodes.getById(grandchild.id)).toBeNull() // 子孙节点被级联删除
    expect(db.moveNodes.getById(child2.id)).not.toBeNull() // 兄弟节点不受影响
    expect(db.moveNodes.getById(root.id)?.childrenIds).toEqual([child2.id])
  })

  it('updateBoardState 能更新节点的局面FEN（摆局阶段结束时用来修正根节点局面）', () => {
    const root = db.moveNodes.create({ parentId: null, move: '', moveCoord: '', boardStateFEN: 'empty-fen' })
    const updated = db.moveNodes.updateBoardState(root.id, 'arranged-fen')
    expect(updated?.boardStateFEN).toBe('arranged-fen')
    expect(db.moveNodes.getById(root.id)?.boardStateFEN).toBe('arranged-fen')
  })

  it('getPathFromRoot 在多层分支树上能返回正确顺序的完整路径', () => {
    const root = createRoot()
    const a = db.moveNodes.create({ parentId: root.id, move: 'A', moveCoord: 'a', boardStateFEN: 'fa' })
    const b = db.moveNodes.create({ parentId: a.id, move: 'B', moveCoord: 'b', boardStateFEN: 'fb' })
    const c = db.moveNodes.create({ parentId: b.id, move: 'C', moveCoord: 'c', boardStateFEN: 'fc' })

    const path = db.moveNodes.getPathFromRoot(c.id)
    expect(path.map((n) => n.id)).toEqual([root.id, a.id, b.id, c.id])
  })
})
