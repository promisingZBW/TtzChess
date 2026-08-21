// 在"伪合法走法"（moves.ts）基础上，过滤掉"走完这步会导致自己被将军"的走法，
// 得到真正可以走的"合法走法"；并提供将军/绝杀/困毙的判断。
//
// 象棋规则提醒（和国际象棋不同）：无子可走（困毙）不是和棋，落子方直接判负，
// 所以 isCheckmate 和 isStalemate 都代表"这一方输了"，只是原因不同（被将死 vs 无子可走）。

import { applyMove, findGeneral } from './board'
import { generatePseudoLegalMoves } from './moves'
import type { Board, Move, Position, Side } from './types'

/** target 这个格子，是否被 bySide 一方的任意棋子"覆盖"（可以在下一步吃到它） */
export function isSquareAttacked(board: Board, target: Position, bySide: Side): boolean {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (!piece || piece.side !== bySide) continue
      const targets = generatePseudoLegalMoves(board, { row, col })
      if (targets.some((p) => p.row === target.row && p.col === target.col)) return true
    }
  }
  return false
}

export function isInCheck(board: Board, side: Side): boolean {
  const generalPos = findGeneral(board, side)
  if (!generalPos) return false // 理论上不会出现（棋盘上没有将/帅），属于非法局面，交给上层处理
  const opponentSide = side === 'red' ? 'black' : 'red'
  return isSquareAttacked(board, generalPos, opponentSide)
}

/** 某一方全部棋子的伪合法走法（还没过滤"是否会导致自己被将军"） */
export function getPseudoLegalMovesForSide(board: Board, side: Side): Move[] {
  const moves: Move[] = []
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (!piece || piece.side !== side) continue
      const from: Position = { row, col }
      for (const to of generatePseudoLegalMoves(board, from)) {
        moves.push({ from, to })
      }
    }
  }
  return moves
}

/** 某一方全部真正合法的走法：模拟走完这步后，自己的将/帅不能处于被将军状态 */
export function getLegalMoves(board: Board, side: Side): Move[] {
  return getPseudoLegalMovesForSide(board, side).filter((move) => {
    const nextBoard = applyMove(board, move)
    return !isInCheck(nextBoard, side)
  })
}

/** 从某个具体格子出发，能走到的所有合法目标 */
export function getLegalMovesFrom(board: Board, from: Position): Move[] {
  const piece = board[from.row][from.col]
  if (!piece) return []
  return getLegalMoves(board, piece.side).filter(
    (move) => move.from.row === from.row && move.from.col === from.col
  )
}

/** 给定一步棋，判断它对当前棋盘来说是否合法（供UI点击交互直接调用） */
export function isLegalMove(board: Board, move: Move): boolean {
  return getLegalMovesFrom(board, move.from).some(
    (candidate) => candidate.to.row === move.to.row && candidate.to.col === move.to.col
  )
}

export function isCheckmate(board: Board, side: Side): boolean {
  return isInCheck(board, side) && getLegalMoves(board, side).length === 0
}

export function isStalemate(board: Board, side: Side): boolean {
  return !isInCheck(board, side) && getLegalMoves(board, side).length === 0
}

export type GameStatus = 'checkmate' | 'stalemate' | 'check' | 'ongoing'

/** 供UI展示用的综合状态：结合"是否被将军"和"是否还有合法走法" */
export function getGameStatus(board: Board, side: Side): GameStatus {
  const inCheck = isInCheck(board, side)
  const legalMoveCount = getLegalMoves(board, side).length
  if (legalMoveCount === 0) return inCheck ? 'checkmate' : 'stalemate'
  return inCheck ? 'check' : 'ongoing'
}
