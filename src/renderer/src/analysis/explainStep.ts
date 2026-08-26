// 把单次分析每一步的原始特征（子力差数字、UCCI 威胁格、胜率）翻成人能读的结论。
// 纯函数、不碰引擎：UI 和测试共用这一层，避免面板里临时拼句子。
//
// 展示原则（和产品约定一致）：
// 1. 标题是一句人话，数字放第二行
// 2. 子力变化说成棋子；没吃子就不提
// 3. 威胁用中文路数，不用 e9 这种引擎坐标
// 4. 先结论（局面转好/转差）再证据（捉子、吃子）

import { fileLabel, getPieceLabel, PIECE_VALUES } from '@shared/chess'
import type { Side, ThreatInfo } from '@shared/chess'
import type { SingleAnalysisStep } from './singlePositionAnalysis'

const SIDE_LABEL: Record<Side, string> = { red: '红', black: '黑' }
const COUNT_WORDS = ['', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十']

/** 胜率变动超过这个百分点，标题才说「转好/转差」，否则算变化不大 */
const WIN_RATE_HEADLINE_THRESHOLD = 1.5

/** 机动性差变化不到这个值，标题里不提活动空间 */
const MOBILITY_HEADLINE_THRESHOLD = 2

export type WinRateTrend = 'up' | 'down' | 'flat'

export interface ExplainedStep {
  headline: string
  winRateTrend: WinRateTrend
  /** 有吃子/丢子时的棋子说法，例如「吃掉一匹马」；没变化则为 null */
  materialPhrase: string | null
}

export function winRateTrend(beforePercent: number, afterPercent: number): WinRateTrend {
  if (afterPercent > beforePercent) return 'up'
  if (afterPercent < beforePercent) return 'down'
  return 'flat'
}

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n)
}

function formatPieceGroup(kind: 'R' | 'C' | 'N' | 'BA' | 'P', count: number): string {
  const n = countWord(count)
  if (kind === 'N') return `${n}匹马`
  if (kind === 'BA') return `${n}仕/象`
  if (kind === 'R') return `${n}车`
  if (kind === 'C') return `${n}炮`
  return `${n}兵`
}

/**
 * 把子力差的绝对值拆成棋子。炮 285、马 270 很接近，纯贪心会把「一马两兵」(330)
 * 错拆成「一炮一兵余15分」。这里用完全背包：优先凑整，同样凑整时用更少的棋子。
 */
export function describeMaterialPieces(absValue: number): string {
  const units: Array<{ value: number; kind: 'R' | 'C' | 'N' | 'BA' | 'P' }> = [
    { value: PIECE_VALUES.R, kind: 'R' },
    { value: PIECE_VALUES.C, kind: 'C' },
    { value: PIECE_VALUES.N, kind: 'N' },
    { value: PIECE_VALUES.B, kind: 'BA' },
    { value: PIECE_VALUES.P, kind: 'P' }
  ]

  const pieceCount = (counts: number[]): number => counts.reduce((sum, n) => sum + n, 0)
  const dp: Array<number[] | null> = Array.from({ length: absValue + 1 }, () => null)
  dp[0] = units.map(() => 0)

  for (let sum = 0; sum <= absValue; sum++) {
    const current = dp[sum]
    if (!current) continue
    for (let i = 0; i < units.length; i++) {
      const next = sum + units[i].value
      if (next > absValue) continue
      const counts = current.slice()
      counts[i] += 1
      const existing = dp[next]
      if (!existing || pieceCount(counts) < pieceCount(existing)) {
        dp[next] = counts
      }
    }
  }

  let bestSum = 0
  for (let sum = absValue; sum >= 0; sum--) {
    if (dp[sum]) {
      bestSum = sum
      break
    }
  }

  const best = dp[bestSum]
  if (!best) return `约${absValue}分`

  const parts: string[] = []
  for (let i = 0; i < units.length; i++) {
    if (best[i] > 0) parts.push(formatPieceGroup(units[i].kind, best[i]))
  }

  const remain = absValue - bestSum
  if (parts.length === 0) return `约${absValue}分`
  if (remain > 0) return `${parts.join('')}（余${remain}分）`
  return parts.join('')
}

/** 从走子方视角描述这一步的子力变化；差值为 0 时返回 null（没吃子就别提） */
export function describeMaterialChange(
  materialDiffBefore: number,
  materialDiffAfter: number,
  moverSide: Side
): string | null {
  const delta = materialDiffAfter - materialDiffBefore
  if (delta === 0) return null

  const redGained = delta > 0
  const moverGained = moverSide === 'red' ? redGained : !redGained
  const pieces = describeMaterialPieces(Math.abs(delta))
  return moverGained ? `吃掉${pieces}` : `丢掉${pieces}`
}

function mobilityPhrase(
  mobilityDiffBefore: number,
  mobilityDiffAfter: number,
  perspective: Side
): string | null {
  const delta = mobilityDiffAfter - mobilityDiffBefore
  if (Math.abs(delta) < MOBILITY_HEADLINE_THRESHOLD) return null
  const improved = perspective === 'red' ? delta > 0 : delta < 0
  return improved ? '活动空间略增' : '活动空间略减'
}

/** 「红五路车捉黑5路马」——路数按各自记谱习惯，不用 UCCI 格子 */
export function describeThreat(threat: ThreatInfo): string {
  const attacker = threat.attacker
  const target = threat.target
  const attackerFile = fileLabel(attacker.pos.col, attacker.piece.side)
  const targetFile = fileLabel(target.pos.col, target.piece.side)
  return (
    `${SIDE_LABEL[attacker.piece.side]}${attackerFile}路${getPieceLabel(attacker.piece)}` +
    `捉` +
    `${SIDE_LABEL[target.piece.side]}${targetFile}路${getPieceLabel(target.piece)}`
  )
}

function conclusionFromWinRate(delta: number): string {
  if (delta > WIN_RATE_HEADLINE_THRESHOLD) return '局面转好'
  if (delta < -WIN_RATE_HEADLINE_THRESHOLD) return '局面转差'
  return '局面变化不大'
}

export function explainAnalysisStep(step: SingleAnalysisStep, perspective: Side): ExplainedStep {
  const wrDelta = step.winRateAfterPercent - step.winRateBeforePercent
  const conclusion = conclusionFromWinRate(wrDelta)
  const materialPhrase = describeMaterialChange(
    step.materialDiffBefore,
    step.materialDiffAfter,
    step.moverSide
  )

  const evidence: string[] = []
  if (step.isDiscoveredThreat) evidence.push('抽将')
  for (const threat of step.threats) evidence.push(describeThreat(threat))
  if (materialPhrase) evidence.push(materialPhrase)

  if (evidence.length === 0) {
    const mobility = mobilityPhrase(step.mobilityDiffBefore, step.mobilityDiffAfter, perspective)
    if (mobility) evidence.push(mobility)
  }

  let headline: string
  if (evidence.length === 0) {
    headline = conclusion
  } else if (wrDelta > WIN_RATE_HEADLINE_THRESHOLD) {
    headline = `这一步好在${evidence.join('，')}`
  } else {
    headline = `${conclusion}：${evidence.join('，')}`
  }

  return {
    headline,
    winRateTrend: winRateTrend(step.winRateBeforePercent, step.winRateAfterPercent),
    materialPhrase
  }
}
