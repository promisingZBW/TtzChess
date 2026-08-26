import { describe, expect, it } from 'vitest'
import { parseFen } from '@shared/chess'
import type { EngineAnalysisResult, EngineWdl } from '@shared/engine'
import type { ThreatInfo } from '@shared/chess'
import {
  describeMaterialChange,
  describeMaterialPieces,
  describeThreat,
  explainAnalysisStep
} from './explainStep'
import { PIN_DETECTION_DISCLAIMER, runSinglePositionAnalysis } from './singlePositionAnalysis'

function fakeResult(wdl: EngineWdl, pv: string[] = []): EngineAnalysisResult {
  return { fen: '', depth: 12, scoreCp: 0, isMate: false, mateIn: null, wdl, pv, fromCache: false }
}

function rookThreatensHorse(): ThreatInfo {
  return {
    attacker: { pos: { row: 6, col: 4 }, piece: { kind: 'R', side: 'red' } },
    target: { pos: { row: 0, col: 4 }, piece: { kind: 'N', side: 'black' } }
  }
}

describe('describeThreat：中文路数，不用引擎坐标', () => {
  it('红车捉中路黑马写成「红五路车捉黑5路马」，不含 e9 这类 UCCI', () => {
    const text = describeThreat(rookThreatensHorse())
    expect(text).toBe('红五路车捉黑5路马')
    expect(text).not.toMatch(/[a-i]\d/)
  })
})

describe('describeMaterialChange：子力差翻成棋子，没吃子就不提', () => {
  it('红方吃马（+270）说成吃掉一匹马', () => {
    expect(describeMaterialChange(0, 270, 'red')).toBe('吃掉一匹马')
  })

  it('黑方吃马时红-黑差变小，从黑方视角仍是吃掉一匹马', () => {
    expect(describeMaterialChange(270, 0, 'black')).toBe('吃掉一匹马')
  })

  it('没吃子返回 null', () => {
    expect(describeMaterialChange(330, 330, 'red')).toBeNull()
  })

  it('330 分拆成一匹马两兵，而不是贪心成一炮一兵', () => {
    expect(describeMaterialPieces(330)).toBe('一匹马两兵')
  })

  it('正好一炮时说一炮', () => {
    expect(describeMaterialPieces(285)).toBe('一炮')
  })
})

describe('explainAnalysisStep：先结论后人话证据', () => {
  const { board } = parseFen('4n4/9/9/9/9/9/9/9/9/4R4 w - - 0 1')

  it('车捉马且胜率下降时，标题是「局面转差：红五路车捉黑5路马」', async () => {
    const pv = ['e0e3', 'e9d7']
    let calls = 0
    async function fakeAnalyze(): Promise<EngineAnalysisResult> {
      calls += 1
      if (calls === 1) return fakeResult([700, 200, 100], pv)
      if (calls === 2) return fakeResult([300, 200, 500])
      return fakeResult([650, 150, 200])
    }

    const result = await runSinglePositionAnalysis(board, 'red', fakeAnalyze, { pvSteps: 2 })
    const explained = explainAnalysisStep(result.steps[0], result.perspective)

    expect(explained.headline).toBe('局面转差：红五路车捉黑5路马')
    expect(explained.headline.startsWith('局面转差')).toBe(true)
    expect(explained.winRateTrend).toBe('down')
    expect(explained.materialPhrase).toBeNull()
    expect(explained.headline).not.toContain(PIN_DETECTION_DISCLAIMER)
    expect(explained.headline).not.toMatch(/[a-i]\d/)
  })

  it('胜率明显上升且吃子时，标题用「这一步好在…」', () => {
    const explained = explainAnalysisStep(
      {
        stepNumber: 1,
        moveNotation: '车五进四',
        moveCoord: 'e3e9',
        moverSide: 'red',
        winRateBeforePercent: 50,
        winRateAfterPercent: 72,
        materialDiffBefore: 330,
        materialDiffAfter: 600,
        mobilityDiffBefore: 0,
        mobilityDiffAfter: 2,
        threats: [],
        isDiscoveredThreat: false
      },
      'red'
    )
    expect(explained.headline).toBe('这一步好在吃掉一匹马')
    expect(explained.winRateTrend).toBe('up')
    expect(explained.materialPhrase).toBe('吃掉一匹马')
  })
})
