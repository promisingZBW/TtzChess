import { describe, expect, it } from 'vitest'
import type { OpeningRoot } from '@shared/moveTree'
import { buildSunburstCenters, ensureAllPieceTypeRoots } from './openingSunburstUtils'

describe('buildSunburstCenters', () => {
  it('一个中心点下只有一条棋路：studies里只有这一条，字段原样带出', () => {
    const roots: OpeningRoot[] = [{ pieceType: 'C', centerLabel: '当头炮局', studyIds: ['s1'] }]
    const titles = new Map([['s1', '中炮直车']])

    const centers = buildSunburstCenters(roots, titles)

    expect(centers).toHaveLength(1)
    expect(centers[0].pieceType).toBe('C')
    expect(centers[0].centerLabel).toBe('当头炮局')
    expect(centers[0].studies).toEqual([{ studyId: 's1', title: '中炮直车' }])
  })

  it('同一个中心点下有多条独立棋路，按创建顺序排列，各自互不影响', () => {
    const roots: OpeningRoot[] = [{ pieceType: 'C', centerLabel: '当头炮局', studyIds: ['a', 'b'] }]
    const titles = new Map([
      ['a', '棋路A'],
      ['b', '棋路B']
    ])

    const [center] = buildSunburstCenters(roots, titles)
    expect(center.studies.map((s) => s.title)).toEqual(['棋路A', '棋路B'])
  })

  it('多个中心点分别渲染，互不干扰', () => {
    const roots: OpeningRoot[] = [
      { pieceType: 'C', centerLabel: '当头炮局', studyIds: ['c'] },
      { pieceType: 'N', centerLabel: '起马局', studyIds: ['n'] }
    ]
    const titles = new Map([
      ['c', '炮局'],
      ['n', '马局']
    ])

    const centers = buildSunburstCenters(roots, titles)
    expect(centers.map((c) => c.pieceType)).toEqual(['C', 'N'])
    expect(centers.map((c) => c.studies[0].title)).toEqual(['炮局', '马局'])
  })

  it('还没创建任何棋路的中心点：studies是空数组，不是报错', () => {
    const roots: OpeningRoot[] = [{ pieceType: 'C', centerLabel: '当头炮局', studyIds: [] }]
    const [center] = buildSunburstCenters(roots, new Map())
    expect(center.studies).toEqual([])
  })

  it('titles里查不到的studyId会被跳过，不影响其它棋路正常渲染', () => {
    const roots: OpeningRoot[] = [{ pieceType: 'C', centerLabel: '当头炮局', studyIds: ['a', 'missing'] }]
    const [center] = buildSunburstCenters(roots, new Map([['a', '棋路A']]))
    expect(center.studies).toHaveLength(1)
    expect(center.studies[0].title).toBe('棋路A')
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
