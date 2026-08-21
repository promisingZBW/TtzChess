// 阶段7：局面特征提取（子力/机动性/威胁/抽将检测），完整移植自 xiangqi_feature_extraction.py，
// 逻辑保持一致（同一组测试局面下，输出数值和Python原型逐项相同，见 __tests__/features.test.ts）。
//
// 和Python原型的一个关键差异：这里的"机动性统计"直接复用阶段1规则引擎已经写好、有完整单元测试
// 覆盖的 generatePseudoLegalMoves / getPseudoLegalMovesForSide（moves.ts / legalMoves.ts），
// 不是照抄Python那套走法生成再写一遍——这样特征提取用到的走法规则，和真正下棋校验用的是
// 同一份代码，不会出现"规则引擎认为合法，特征统计这边算错"这种两边逻辑不一致的风险。
//
// 阶段11（已明确排除/暂缓的功能）：牵制检测第一版不做，见 dev guide 第9节末尾的说明——
// 调用方（阶段8的AI分析UI）展示结果时，需要明确告知用户"未检测牵制"，避免误以为分析是完整的。

import { generatePseudoLegalMoves } from './moves'
import { getPseudoLegalMovesForSide } from './legalMoves'
import { getPieceValue, THREAT_VALUE_THRESHOLD } from './pieceValues'
import { opponentOf, samePosition } from './types'
import type { Board, Move, Piece, Position, Side } from './types'

/** 某一方的子力总值（对应Python的 get_material_score） */
export function materialScore(board: Board, side: Side): number {
  let total = 0
  for (const row of board) {
    for (const square of row) {
      if (square && square.side === side) total += getPieceValue(square.kind)
    }
  }
  return total
}

/** 红方子力 - 黑方子力，正数代表红方子力占优 */
export function materialDiff(board: Board): number {
  return materialScore(board, 'red') - materialScore(board, 'black')
}

/** 某一方全部棋子的"伪合法走法"总数（对应Python的 get_mobility，但走法生成复用阶段1的规则引擎） */
export function mobilityScore(board: Board, side: Side): number {
  return getPseudoLegalMovesForSide(board, side).length
}

/** 红方机动性 - 黑方机动性 */
export function mobilityDiff(board: Board): number {
  return mobilityScore(board, 'red') - mobilityScore(board, 'black')
}

export interface ThreatInfo {
  attacker: { pos: Position; piece: Piece }
  target: { pos: Position; piece: Piece }
}

/**
 * 检查moverSide一方目前所有棋子的攻击范围，是否覆盖了对方的高价值棋子（车/马/炮级别，
 * 见 THREAT_VALUE_THRESHOLD）。返回被威胁的棋子列表（对应Python的 find_threats），
 * 供阶段8的AI分析UI组织成"威胁到对方XX"这样的描述。
 */
export function findThreats(board: Board, moverSide: Side): ThreatInfo[] {
  const opponentSide = opponentOf(moverSide)
  const threats: ThreatInfo[] = []
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (!piece || piece.side !== moverSide) continue
      const from: Position = { row, col }
      for (const to of generatePseudoLegalMoves(board, from)) {
        const targetPiece = board[to.row][to.col]
        if (!targetPiece || targetPiece.side !== opponentSide) continue
        if (getPieceValue(targetPiece.kind) >= THREAT_VALUE_THRESHOLD) {
          threats.push({ attacker: { pos: from, piece }, target: { pos: to, piece: targetPiece } })
        }
      }
    }
  }
  return threats
}

function threatKey(threat: ThreatInfo): string {
  return `${threat.attacker.pos.row},${threat.attacker.pos.col}->${threat.target.pos.row},${threat.target.pos.col}`
}

/**
 * 抽将识别：对比走这一步棋前后，moverSide一方新增了哪些威胁。
 * 如果某个新增威胁的发起棋子不是这一步实际移动的那颗棋子（attacker位置不等于move.to），
 * 说明这个威胁是"移开了别的挡路子之后，后面的子露出来的"，标记为"疑似抽将模式"
 * （dev guide第9节：若威胁的发起棋子不是本步实际移动的那颗棋子，则标记为疑似抽将）。
 */
export function detectDiscoveredThreats(
  boardBefore: Board,
  boardAfter: Board,
  move: Move,
  moverSide: Side
): ThreatInfo[] {
  const beforeKeys = new Set(findThreats(boardBefore, moverSide).map(threatKey))
  const threatsAfter = findThreats(boardAfter, moverSide)
  return threatsAfter.filter(
    (threat) => !beforeKeys.has(threatKey(threat)) && !samePosition(threat.attacker.pos, move.to)
  )
}

export interface MoveFeatureDiff {
  materialDiffBefore: number
  materialDiffAfter: number
  mobilityDiffBefore: number
  mobilityDiffAfter: number
  /** moverSide一方走完这步之后，威胁到的对方高价值棋子列表 */
  threatsAfter: ThreatInfo[]
  /** threatsAfter的子集：发起者不是这一步实际移动的棋子，即"疑似抽将模式" */
  discoveredThreats: ThreatInfo[]
}

/**
 * 整合一步棋前后的全部特征变化，对应 xiangqi_feature_extraction.py 里的 build_feature_summary，
 * 但不掺入引擎评分（eval_before/eval_after）——那部分是阶段6 EngineService的职责，
 * 阶段8的AI分析UI会把这里的结果和EngineService.analyzePosition的结果拼在一起展示。
 */
export function buildMoveFeatureDiff(
  boardBefore: Board,
  boardAfter: Board,
  move: Move,
  moverSide: Side
): MoveFeatureDiff {
  return {
    materialDiffBefore: materialDiff(boardBefore),
    materialDiffAfter: materialDiff(boardAfter),
    mobilityDiffBefore: mobilityDiff(boardBefore),
    mobilityDiffAfter: mobilityDiff(boardAfter),
    threatsAfter: findThreats(boardAfter, moverSide),
    discoveredThreats: detectDiscoveredThreats(boardBefore, boardAfter, move, moverSide)
  }
}
