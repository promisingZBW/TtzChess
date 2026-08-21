// 棋盘相关的基础工具函数：创建初始棋盘、克隆、边界/九宫判断、应用一步棋等。
// 这些函数不涉及"这步棋是否合法"的判断，纯粹是棋盘状态的读写工具。

import { parseFen, STANDARD_START_FEN } from './fen'
import type { Board, Move, Position, Side } from './types'

export function createInitialBoard(): Board {
  return parseFen(STANDARD_START_FEN).board
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((square) => (square ? { ...square } : null)))
}

export function inBoard(row: number, col: number): boolean {
  return row >= 0 && row <= 9 && col >= 0 && col <= 8
}

/** 九宫格：红方在row 7-9，黑方在row 0-2，都限定在col 3-5 */
export function inPalace(row: number, col: number, side: Side): boolean {
  const rows = side === 'red' ? [7, 8, 9] : [0, 1, 2]
  return rows.includes(row) && col >= 3 && col <= 5
}

/**
 * 该行是否已经"过河"（越过对方半场的界线）。
 * 红方：row<=4 视为已过河（进入黑方半场）；黑方：row>=5 视为已过河。
 * 主要用途：(1) 象/相不能过河；(2) 兵/卒过河后才能左右移动。
 */
export function crossedRiver(row: number, side: Side): boolean {
  return side === 'red' ? row <= 4 : row >= 5
}

export function findGeneral(board: Board, side: Side): Position | null {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const square = board[row][col]
      if (square && square.kind === 'K' && square.side === side) {
        return { row, col }
      }
    }
  }
  return null
}

/** 应用一步棋，返回一个新棋盘（不修改传入的board），不做任何合法性校验 */
export function applyMove(board: Board, move: Move): Board {
  const next = cloneBoard(board)
  const piece = next[move.from.row][move.from.col]
  next[move.from.row][move.from.col] = null
  next[move.to.row][move.to.col] = piece
  return next
}
