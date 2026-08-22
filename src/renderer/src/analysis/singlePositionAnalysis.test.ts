import { describe, expect, it } from 'vitest'
import { parseFen } from '@shared/chess'
import type { EngineAnalysisResult, EngineWdl } from '@shared/engine'
import {
  DEFAULT_PV_STEPS,
  runSinglePositionAnalysis,
  winRatePercentFromPerspective
} from './singlePositionAnalysis'

function fakeResult(wdl: EngineWdl, pv: string[] = []): EngineAnalysisResult {
  return { fen: '', depth: 12, scoreCp: 0, isMate: false, mateIn: null, wdl, pv, fromCache: false }
}

describe('winRatePercentFromPerspective', () => {
  it('WDL视角和目标视角一致时，直接取win字段换算成百分比', () => {
    expect(winRatePercentFromPerspective([700, 200, 100], 'red', 'red')).toBe(70)
  })

  it('WDL视角和目标视角相反时，用loss字段换算（对方的负就是我方的胜）', () => {
    expect(winRatePercentFromPerspective([300, 200, 500], 'black', 'red')).toBe(50)
  })
})

describe('runSinglePositionAnalysis（沿PV模拟+胜率视角统一，用假引擎函数验证，不依赖真实Pikafish）', () => {
  // 局面：红车(9,4)，黑马(0,4)，红方先走
  const { board } = parseFen('4n4/9/9/9/9/9/9/9/9/4R4 w - - 0 1')

  it('两步PV：车下移直接威胁黑马、黑马跳开；胜率按红方视角连贯换算，特征差和阶段7的独立测试结果吻合', async () => {
    // PV: 车(9,4)->(6,4)  黑马(0,4)->(2,3)
    const pv = ['e0e3', 'e9d7']
    const calls: string[] = []
    async function fakeAnalyze(fen: string): Promise<EngineAnalysisResult> {
      calls.push(fen)
      if (calls.length === 1) return fakeResult([700, 200, 100], pv) // 根节点：红方视角70%
      if (calls.length === 2) return fakeResult([300, 200, 500]) // 车走完后，轮到黑方；黑方视角30%->换算成红方视角50%
      return fakeResult([650, 150, 200]) // 黑马走完后，轮到红方；红方视角65%
    }

    const result = await runSinglePositionAnalysis(board, 'red', fakeAnalyze, { pvSteps: 2 })

    expect(result.perspective).toBe('red')
    expect(result.rootWinRatePercent).toBe(70)
    expect(result.steps).toHaveLength(2)

    const [step1, step2] = result.steps
    expect(step1.moveNotation).toBe('车五进三')
    expect(step1.winRateBeforePercent).toBe(70)
    expect(step1.winRateAfterPercent).toBe(50)
    // 车走到(6,4)正好和阶段7 features.test.ts里"rook_threatens_horse"是同一个局面，子力差330完全吻合
    expect(step1.materialDiffBefore).toBe(330)
    expect(step1.materialDiffAfter).toBe(330)
    expect(step1.threats).toHaveLength(1)
    expect(step1.isDiscoveredThreat).toBe(false) // 车自己走过去造成的直接威胁，不是抽将
    expect(step1.note).toContain('未检测牵制')

    expect(step2.winRateBeforePercent).toBe(50) // 承接上一步换算后的结果，没有重复查询根节点
    expect(step2.winRateAfterPercent).toBe(65)
    expect(step2.threats).toHaveLength(0) // 黑马跳开之后没有形成对红方高价值棋子的威胁

    // 一共应该只查询了3次引擎：根节点1次 + 每步PV各1次，没有多余的重复调用
    expect(calls).toHaveLength(3)
  })

  it('pvSteps限制返回的步数，即便引擎PV更长也只模拟前N步', async () => {
    const longPv = ['e0e3', 'e9d7', 'e3e4', 'd7c5']
    async function fakeAnalyze(): Promise<EngineAnalysisResult> {
      return fakeResult([500, 0, 500], longPv)
    }
    const result = await runSinglePositionAnalysis(board, 'red', fakeAnalyze, { pvSteps: 1 })
    expect(result.steps).toHaveLength(1)
  })

  it('默认pvSteps是5', () => {
    expect(DEFAULT_PV_STEPS).toBe(5)
  })
})
