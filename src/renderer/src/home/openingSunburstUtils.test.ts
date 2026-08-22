import { describe, expect, it } from 'vitest'
import type { MoveNode, OpeningRoot } from '@shared/moveTree'
import { buildSunburstCenters, ensureAllPieceTypeRoots, type SunburstStudyData } from './openingSunburstUtils'

function node(id: string, parentId: string | null, childrenIds: string[], move = ''): MoveNode {
  return { id, parentId, childrenIds, move, moveCoord: '', boardStateFEN: '', note: null, hasNote: false, createdAt: 0 }
}

describe('buildSunburstCenters', () => {
  it('还没有走任何棋的空白棋路：顶层扇区存在，但没有子扇区', () => {
    const nodes = new Map([['root', node('root', null, [])]])
    const study: SunburstStudyData = { studyId: 's1', title: '中炮直车', rootNodeId: 'root', nodes }
    const roots: OpeningRoot[] = [{ pieceType: 'C', centerLabel: '当头炮局', studyIds: ['s1'] }]

    const centers = buildSunburstCenters(roots, new Map([['s1', study]]))

    expect(centers).toHaveLength(1)
    expect(centers[0].pieceType).toBe('C')
    expect(centers[0].segments).toEqual([{ id: 's1', studyId: 's1', label: '中炮直车', children: [] }])
  })

  it('走了两步的直线棋路：嵌套深度和棋谱树一致', () => {
    const nodes = new Map([
      ['root', node('root', null, ['m1'])],
      ['m1', node('m1', 'root', ['m2'], '炮二平五')],
      ['m2', node('m2', 'm1', [], '马8进7')]
    ])
    const study: SunburstStudyData = { studyId: 's1', title: '中炮局', rootNodeId: 'root', nodes }
    const roots: OpeningRoot[] = [{ pieceType: 'C', centerLabel: '当头炮局', studyIds: ['s1'] }]

    const [center] = buildSunburstCenters(roots, new Map([['s1', study]]))

    expect(center.segments).toHaveLength(1)
    const studySegment = center.segments[0]
    expect(studySegment.children).toHaveLength(1)
    expect(studySegment.children[0]).toMatchObject({ id: 'm1', studyId: 's1', label: '炮二平五' })
    expect(studySegment.children[0].children).toHaveLength(1)
    expect(studySegment.children[0].children[0]).toMatchObject({ id: 'm2', studyId: 's1', label: '马8进7' })
  })

  it('第一步就有分支：顶层挂两个子扇区', () => {
    const nodes = new Map([
      ['root', node('root', null, ['a', 'b'])],
      ['a', node('a', 'root', [], '炮二平五')],
      ['b', node('b', 'root', [], '马二进三')]
    ])
    const study: SunburstStudyData = { studyId: 's1', title: '起马变化', rootNodeId: 'root', nodes }
    const roots: OpeningRoot[] = [{ pieceType: 'N', centerLabel: '起马局', studyIds: ['s1'] }]

    const [center] = buildSunburstCenters(roots, new Map([['s1', study]]))
    expect(center.segments[0].children.map((c) => c.label)).toEqual(['炮二平五', '马二进三'])
  })

  it('同一个中心点下有多条独立棋路，各自互不影响', () => {
    const studyA: SunburstStudyData = {
      studyId: 'a',
      title: '棋路A',
      rootNodeId: 'rootA',
      nodes: new Map([['rootA', node('rootA', null, [])]])
    }
    const studyB: SunburstStudyData = {
      studyId: 'b',
      title: '棋路B',
      rootNodeId: 'rootB',
      nodes: new Map([['rootB', node('rootB', null, [])]])
    }
    const roots: OpeningRoot[] = [{ pieceType: 'C', centerLabel: '当头炮局', studyIds: ['a', 'b'] }]

    const [center] = buildSunburstCenters(
      roots,
      new Map([
        ['a', studyA],
        ['b', studyB]
      ])
    )
    expect(center.segments.map((s) => s.label)).toEqual(['棋路A', '棋路B'])
  })

  it('多个中心点分别渲染，互不干扰', () => {
    const studyC: SunburstStudyData = {
      studyId: 'c',
      title: '炮局',
      rootNodeId: 'r',
      nodes: new Map([['r', node('r', null, [])]])
    }
    const studyN: SunburstStudyData = {
      studyId: 'n',
      title: '马局',
      rootNodeId: 'r2',
      nodes: new Map([['r2', node('r2', null, [])]])
    }
    const roots: OpeningRoot[] = [
      { pieceType: 'C', centerLabel: '当头炮局', studyIds: ['c'] },
      { pieceType: 'N', centerLabel: '起马局', studyIds: ['n'] }
    ]

    const centers = buildSunburstCenters(
      roots,
      new Map([
        ['c', studyC],
        ['n', studyN]
      ])
    )
    expect(centers.map((c) => c.pieceType)).toEqual(['C', 'N'])
  })

  it('studies里查不到的studyId会被跳过，不影响其它棋路正常渲染', () => {
    const studyA: SunburstStudyData = {
      studyId: 'a',
      title: '棋路A',
      rootNodeId: 'rootA',
      nodes: new Map([['rootA', node('rootA', null, [])]])
    }
    const roots: OpeningRoot[] = [{ pieceType: 'C', centerLabel: '当头炮局', studyIds: ['a', 'missing'] }]

    const [center] = buildSunburstCenters(roots, new Map([['a', studyA]]))
    expect(center.segments).toHaveLength(1)
    expect(center.segments[0].label).toBe('棋路A')
  })

  it('棋谱树缓存里缺了某个节点（数据异常）时，跳过它而不是抛错', () => {
    const nodes = new Map([['root', node('root', null, ['missing-child'])]])
    const study: SunburstStudyData = { studyId: 's1', title: '棋路', rootNodeId: 'root', nodes }
    const roots: OpeningRoot[] = [{ pieceType: 'C', centerLabel: '当头炮局', studyIds: ['s1'] }]

    const [center] = buildSunburstCenters(roots, new Map([['s1', study]]))
    expect(center.segments[0].children).toEqual([])
  })
})

describe('ensureAllPieceTypeRoots', () => {
  it('5种起手棋子类型即使一条棋路都没有，也都会补出一个studyIds为空的占位项', () => {
    const result = ensureAllPieceTypeRoots([])
    expect(result).toHaveLength(5)
    expect(result.map((r) => r.pieceType).sort()).toEqual(['B', 'C', 'N', 'P', 'R'])
    expect(result.every((r) => r.studyIds.length === 0)).toBe(true)
  })

  it('已有的类型保留原始数据（studyIds不会被占位覆盖），只补缺失的类型', () => {
    const roots: OpeningRoot[] = [{ pieceType: 'C', centerLabel: '当头炮局', studyIds: ['s1', 's2'] }]
    const result = ensureAllPieceTypeRoots(roots)
    const cEntry = result.find((r) => r.pieceType === 'C')
    expect(cEntry?.studyIds).toEqual(['s1', 's2'])
    expect(result).toHaveLength(5)
  })
})
