// 阶段8：单次分析的核心业务逻辑（dev guide 第7.1节）。刻意写成不依赖window.chessoc的纯函数——
// 调用引擎的动作通过`analyze`参数注入进来，单元测试时可以喂一个假函数，不需要真的启动Pikafish子进程。
//
// 流程：
// 1. 把当前局面转FEN，查一次引擎，拿到根节点的WDL和PV（最佳应对路线）
// 2. 沿PV前面几步（默认5步）逐步模拟：每走一步就(a)单独查一次引擎拿这个新局面的WDL
//    (b)用阶段7的特征提取算子力差/机动性差/威胁/抽将
// 3. 所有WDL统一换算成"分析发起时那一方"的胜率百分比，这样5步下来能连成一条有意义的趋势，
//    不会因为红黑轮流走棋、每步视角切换而看起来忽上忽下

import {
  applyMove,
  boardToFen,
  getPieceLabel,
  moveToChineseNotation,
  opponentOf,
  positionToUcciSquare,
  ucciCoordToMove
} from '@shared/chess'
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
  winRateBeforePercent: number
  winRateAfterPercent: number
  /** 子力差/机动性差固定是"红方-黑方"，和阶段7 features.ts的口径一致，不随视角变化 */
  materialDiffBefore: number
  materialDiffAfter: number
  mobilityDiffBefore: number
  mobilityDiffAfter: number
  threats: ThreatInfo[]
  isDiscoveredThreat: boolean
  note: string
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

/**
 * 引擎返回的WDL默认是"这个局面里轮到走棋的那一方"的视角；换算成固定视角(perspective)下的
 * 胜率百分比（0-100，保留1位小数），供UI画出一条前后连贯、不随红黑轮转而跳变的趋势。
 */
export function winRatePercentFromPerspective(wdl: EngineWdl, wdlSide: Side, perspective: Side): number {
  const [win, , loss] = wdl
  const raw = wdlSide === perspective ? win : loss
  return raw / 10 // 千分制(0-1000)直接除以10就是百分比(0-100)
}

/** 把一条威胁信息组织成"车威胁黑马(e9)"这样的人话描述，供UI直接展示 */
export function describeThreat(threat: ThreatInfo): string {
  const attackerLabel = getPieceLabel(threat.attacker.piece)
  const targetLabel = getPieceLabel(threat.target.piece)
  return `${attackerLabel}威胁${targetLabel}(${positionToUcciSquare(threat.target.pos)})`
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
      winRateBeforePercent: winRateBefore,
      winRateAfterPercent: winRateAfter,
      materialDiffBefore: featureDiff.materialDiffBefore,
      materialDiffAfter: featureDiff.materialDiffAfter,
      mobilityDiffBefore: featureDiff.mobilityDiffBefore,
      mobilityDiffAfter: featureDiff.mobilityDiffAfter,
      threats: featureDiff.threatsAfter,
      isDiscoveredThreat: featureDiff.discoveredThreats.length > 0,
      note: PIN_DETECTION_DISCLAIMER
    })

    currentBoard = nextBoard
    currentSide = nextSide
    winRateBefore = winRateAfter
  }

  return { rootFen, rootWinRatePercent, rootWdl: rootResult.wdl, perspective, steps }
}
