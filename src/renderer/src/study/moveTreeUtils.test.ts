import { describe, expect, it } from 'vitest'
import type { MoveNode } from '@shared/moveTree'
import { buildHierarchy, computePathFromRoot } from './moveTreeUtils'

function makeNode(overrides: Partial<MoveNode> & Pick<MoveNode, 'id' | 'parentId'>): MoveNode {
  return {
    childrenIds: [],
    move: '',
    moveCoord: '',
    boardStateFEN: 'fen',
    note: null,
    hasNote: false,
    createdAt: 0,
    ...overrides
  }
}

// 构造一棵小树：root -> a -> b
//                      -> c（root在a之外还有一个分支c，方便测试多分支场景）
function buildSampleTree(): Map<string, MoveNode> {
  const root = makeNode({ id: 'root', parentId: null, childrenIds: ['a', 'c'] })
  const a = makeNode({ id: 'a', parentId: 'root', childrenIds: ['b'], move: 'A' })
  const b = makeNode({ id: 'b', parentId: 'a', childrenIds: [], move: 'B' })
  const c = makeNode({ id: 'c', parentId: 'root', childrenIds: [], move: 'C' })
  return new Map([
    ['root', root],
    ['a', a],
    ['b', b],
    ['c', c]
  ])
}

describe('buildHierarchy', () => {
  it('把扁平映射组装成嵌套结构，children顺序和childrenIds一致', () => {
    const nodes = buildSampleTree()
    const hierarchy = buildHierarchy(nodes, 'root')

    expect(hierarchy?.id).toBe('root')
    expect(hierarchy?.children.map((c) => c.id)).toEqual(['a', 'c'])
    expect(hierarchy?.children[0].children.map((c) => c.id)).toEqual(['b'])
    expect(hierarchy?.children[1].children).toEqual([])
  })

  it('根节点不存在时返回null', () => {
    const nodes = buildSampleTree()
    expect(buildHierarchy(nodes, 'not-exist')).toBeNull()
  })
})

describe('computePathFromRoot', () => {
  it('对叶子节点返回从根到叶子的完整路径', () => {
    const nodes = buildSampleTree()
    expect(computePathFromRoot(nodes, 'b')).toEqual(['root', 'a', 'b'])
  })

  it('对根节点自己返回只有一个元素的路径', () => {
    const nodes = buildSampleTree()
    expect(computePathFromRoot(nodes, 'root')).toEqual(['root'])
  })

  it('对另一条分支的节点也能返回正确路径，不会串到别的分支上', () => {
    const nodes = buildSampleTree()
    expect(computePathFromRoot(nodes, 'c')).toEqual(['root', 'c'])
  })
})
