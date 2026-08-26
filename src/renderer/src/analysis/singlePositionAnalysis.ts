// 阶段8：单次分析的核心业务逻辑（dev guide 第7.1节）。刻意写成不依赖window.chessoc的纯函数——
// 调用引擎的动作通过`analyze`参数注入进来，单元测试时可以喂一个假函数，不需要真的启动Pikafish子进程。
//
// 流程：
// 1. 把当前局面转FEN，查一次引擎，拿到根节点的WDL和PV（最佳应对路线）
// 2. 沿PV前面几步（默认5步）逐步模拟：每走一步就(a)单独查一次引擎拿这个新局面的WDL
//    (b)用阶段7的特征提取算子力差/机动性差/威胁/抽将
// 3. 所有WDL统一换算成"分析发起时那一方"的胜率百分比，这样5步下来能连成一条有意义的趋势，
//    不会因为红黑轮流走棋、每步视角切换而看起来忽上忽下

import { applyMove, boardToFen, moveToChineseNotation, opponentOf, ucciCoordToMove } from '@shared/chess'
import type { Board, Side } from '@shared/chess'
import { buildMoveFeatureDiff, type ThreatInfo } from '@shared/chess'
import type { EngineAnalysisResult, EngineWdl } from '@shared/engine'

export type AnalyzePositionFn = (fen: string, depth?: number) => Promise<EngineAnalysisResult>

/** dev guide第9/11节：牵制检测第一版不做，任何一次特征分析结果都要明确告知这个能力边界 */
export const PIN_DETECTION_DISCLAIMER = '未检测牵制（第一版特征提取暂不支持，见开发指南第9/11节说明）'

export interface SingleAnalysisStep {
  stepNumber: number
  moveNotation: string
  moveCoord: string
  /** 走出这一步的那一方，用来把「红-黑子力差」翻成走子方吃没吃子 */
  moverSide: Side
  winRateBeforePercent: number
  winRateAfterPercent: number
  /** 子力差/机动性差固定是"红方-黑方"，和阶段7 features.ts的口径一致，不随视角变化 */
  materialDiffBefore: number
  materialDiffAfter: number
  mobilityDiffBefore: number
  mobilityDiffAfter: number
  threats: ThreatInfo[]
  isDiscoveredThreat: boolean
}

export interface SingleAnalysisResult {
  rootFen: string
  rootWinRatePercent: number
  rootWdl: EngineWdl
  /** 胜率百分比统一换算到的视角：分析发起时轮到走棋的那一方 */
  perspective: Side
  steps: SingleAnalysisStep[]
}

export const DEFAULT_PV_STEPS = 5
export const DEFAULT_STEP_DEPTH = 12

/** 鼠标悬停胜率数字时展示给用户看的计算公式说明 */
export const WIN_RATE_FORMULA_HINT =
  '胜率 = 胜 ÷ (胜 + 负)。和棋不参与计算。括号里的胜/和/负仍是引擎千分制（三项合计 1000）。'

/**
 * 把引擎返回的「当前走棋方」WDL，换成指定视角下的 [胜, 和, 负]。
 * 视角相反时只需对调胜和负，和棋不变。
 */
export function wdlFromPerspective(wdl: EngineWdl, wdlSide: Side, perspective: Side): EngineWdl {
  return wdlSide === perspective ? wdl : [wdl[2], wdl[1], wdl[0]]
}

/** 排除和棋后的胜率百分比：胜 / (胜 + 负)，保留 1 位小数；全是和棋时记 50%。 */
export function decisiveWinRatePercent(win: number, loss: number): number {
  const decisive = win + loss
  if (decisive <= 0) return 50
  return Math.round((win / decisive) * 1000) / 10
}

/**
 * 引擎返回的WDL默认是"这个局面里轮到走棋的那一方"的视角；换算成固定视角(perspective)下、
 * 排除和棋后的胜率百分比（0-100，保留1位小数）。
 */
export function winRatePercentFromPerspective(wdl: EngineWdl, wdlSide: Side, perspective: Side): number {
  const [win, , loss] = wdlFromPerspective(wdl, wdlSide, perspective)
  return decisiveWinRatePercent(win, loss)
}

export interface RunSingleAnalysisOptions {
  pvSteps?: number
  stepDepth?: number
}

export async function runSinglePositionAnalysis(
  board: Board,
  sideToMove: Side,
  analyze: AnalyzePositionFn,
  options: RunSingleAnalysisOptions = {}
): Promise<SingleAnalysisResult> {
  const pvSteps = options.pvSteps ?? DEFAULT_PV_STEPS
  const stepDepth = options.stepDepth ?? DEFAULT_STEP_DEPTH
  const perspective = sideToMove

  const rootFen = boardToFen(board, sideToMove)
  const rootResult = await analyze(rootFen)
  const rootWinRatePercent = winRatePercentFromPerspective(rootResult.wdl, sideToMove, perspective)

  const steps: SingleAnalysisStep[] = []
  let currentBoard = board
  let currentSide = sideToMove
  let winRateBefore = rootWinRatePercent

  const pvMoves = rootResult.pv.slice(0, pvSteps)
  for (let i = 0; i < pvMoves.length; i++) {
    const move = ucciCoordToMove(pvMoves[i])
    const fromPiece = currentBoard[move.from.row][move.from.col]
    if (!fromPiece) break // 引擎PV和局面对不上号（理论上不该发生），防御性中断，不让整个分析崩掉

    const moveNotation = moveToChineseNotation(currentBoard, move)
    const nextBoard = applyMove(currentBoard, move)
    const nextSide = opponentOf(currentSide)
    const nextFen = boardToFen(nextBoard, nextSide)

    const stepEngineResult = await analyze(nextFen, stepDepth)
    const winRateAfter = winRatePercentFromPerspective(stepEngineResult.wdl, nextSide, perspective)
    const featureDiff = buildMoveFeatureDiff(currentBoard, nextBoard, move, currentSide)

    steps.push({
      stepNumber: i + 1,
      moveNotation,
      moveCoord: pvMoves[i],
      moverSide: currentSide,
      winRateBeforePercent: winRateBefore,
      winRateAfterPercent: winRateAfter,
      materialDiffBefore: featureDiff.materialDiffBefore,
      materialDiffAfter: featureDiff.materialDiffAfter,
      mobilityDiffBefore: featureDiff.mobilityDiffBefore,
      mobilityDiffAfter: featureDiff.mobilityDiffAfter,
      threats: featureDiff.threatsAfter,
      isDiscoveredThreat: featureDiff.discoveredThreats.length > 0
    })

    currentBoard = nextBoard
    currentSide = nextSide
    winRateBefore = winRateAfter
  }

  return { rootFen, rootWinRatePercent, rootWdl: rootResult.wdl, perspective, steps }
}
