// 每种棋子的"伪合法走法"生成：只校验该棋子自身的移动规则（含蹩马腿/塞象眼/不能过河/
// 不能落在己方棋子上），不校验"走完这步后自己的将/帅是否被将军"——那一层过滤在
// legalMoves.ts 里做。
//
// 注意：这里的实现和 xiangqi_feature_extraction.py 里的走法生成看起来相似，但做了一个
// 关键修正——原型代码只是为了粗略统计"机动性"，允许把棋子挪到己方棋子所在的格子上；
// 这里作为真正的规则引擎，明确排除了"吃自己棋子"的非法情况。

import { crossedRiver, inBoard, inPalace } from './board'
import type { Board, Position, Side } from './types'

const ORTHOGONAL_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
]

const DIAGONAL_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
]

/** 目标格在棋盘内，且不是己方棋子占据，才是一个有效落点（空格=移动，敌方棋子=吃子） */
function pushIfLandable(board: Board, side: Side, row: number, col: number, moves: Position[]): void {
  if (!inBoard(row, col)) return
  const occupant = board[row][col]
  if (!occupant || occupant.side !== side) {
    moves.push({ row, col })
  }
}

/** 车：直线滑动，遇子止步；若第一个遇到的子是敌方棋子，可以吃 */
export function generateRookMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  for (const [dr, dc] of ORTHOGONAL_DIRS) {
    let r = pos.row + dr
    let c = pos.col + dc
    while (inBoard(r, c)) {
      const occupant = board[r][c]
      if (!occupant) {
        moves.push({ row: r, col: c })
      } else {
        if (occupant.side !== side) moves.push({ row: r, col: c })
        break
      }
      r += dr
      c += dc
    }
  }
  return moves
}

/** 炮：不吃子时和车一样直线滑动；吃子必须隔着恰好一个"炮架"（任意方的子都可以当炮架） */
export function generateCannonMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  for (const [dr, dc] of ORTHOGONAL_DIRS) {
    let jumped = false
    let r = pos.row + dr
    let c = pos.col + dc
    while (inBoard(r, c)) {
      const occupant = board[r][c]
      if (!jumped) {
        if (!occupant) {
          moves.push({ row: r, col: c })
        } else {
          jumped = true
        }
      } else if (occupant) {
        if (occupant.side !== side) moves.push({ row: r, col: c })
        break
      }
      r += dr
      c += dc
    }
  }
  return moves
}

/** 马：日字走法，每个方向先检查"蹩马腿"的那个格子是否被占用 */
export function generateHorseMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  const steps: ReadonlyArray<{
    leg: readonly [number, number]
    target: readonly [number, number]
  }> = [
    { leg: [0, 1], target: [1, 2] },
    { leg: [0, 1], target: [-1, 2] },
    { leg: [0, -1], target: [1, -2] },
    { leg: [0, -1], target: [-1, -2] },
    { leg: [1, 0], target: [2, 1] },
    { leg: [1, 0], target: [2, -1] },
    { leg: [-1, 0], target: [-2, 1] },
    { leg: [-1, 0], target: [-2, -1] }
  ]
  for (const { leg, target } of steps) {
    const legRow = pos.row + leg[0]
    const legCol = pos.col + leg[1]
    if (inBoard(legRow, legCol) && board[legRow][legCol]) continue // 蹩马腿
    pushIfLandable(board, side, pos.row + target[0], pos.col + target[1], moves)
  }
  return moves
}

/** 象/相：田字走法，检查"塞象眼"，且不能过河 */
export function generateElephantMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  for (const [dr, dc] of DIAGONAL_DIRS) {
    const targetRow = pos.row + dr * 2
    const targetCol = pos.col + dc * 2
    if (!inBoard(targetRow, targetCol)) continue
    if (crossedRiver(targetRow, side)) continue // 不能过河
    const eyeRow = pos.row + dr
    const eyeCol = pos.col + dc
    if (board[eyeRow][eyeCol]) continue // 塞象眼
    pushIfLandable(board, side, targetRow, targetCol, moves)
  }
  return moves
}

/** 仕/士：九宫内斜走一步 */
export function generateAdvisorMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  for (const [dr, dc] of DIAGONAL_DIRS) {
    const targetRow = pos.row + dr
    const targetCol = pos.col + dc
    if (!inBoard(targetRow, targetCol) || !inPalace(targetRow, targetCol, side)) continue
    pushIfLandable(board, side, targetRow, targetCol, moves)
  }
  return moves
}

/** 兵/卒：过河前只能直走一步；过河后可以直走或左右走一步，但永远不能后退 */
export function generateSoldierMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  const forwardDr = side === 'red' ? -1 : 1
  pushIfLandable(board, side, pos.row + forwardDr, pos.col, moves)
  if (crossedRiver(pos.row, side)) {
    pushIfLandable(board, side, pos.row, pos.col + 1, moves)
    pushIfLandable(board, side, pos.row, pos.col - 1, moves)
  }
  return moves
}

/**
 * 找到"飞将"目标：如果沿同一列一路清空到底，正好碰到对方的将/帅，
 * 就把它当作一个可以被"吃"的目标格返回。
 *
 * 这不是一个真的允许发生的走法（真的走出这一步，落子方自己就会被判负），
 * 而是判断"将军"的标准实现技巧：只要让"将/帅"的伪合法走法里包含这个飞将目标，
 * 之后统一用"这个格子是否被对方伪合法走法覆盖"来判断将军，就不需要给"照面将"
 * 单独写一套检测逻辑，两条规则（普通将军 + 照面将）可以合并成同一套代码处理。
 */
function findFlyingGeneralTarget(board: Board, pos: Position, side: Side): Position | null {
  const opponentSide = side === 'red' ? 'black' : 'red'
  const dr = side === 'red' ? -1 : 1
  let row = pos.row + dr
  while (inBoard(row, pos.col)) {
    const occupant = board[row][pos.col]
    if (occupant) {
      if (occupant.kind === 'K' && occupant.side === opponentSide) {
        return { row, col: pos.col }
      }
      return null // 中间被别的子挡住了，不构成照面
    }
    row += dr
  }
  return null
}

/** 将/帅：九宫内直走一步，额外附带"飞将"目标（见上面函数注释） */
export function generateGeneralMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  for (const [dr, dc] of ORTHOGONAL_DIRS) {
    const targetRow = pos.row + dr
    const targetCol = pos.col + dc
    if (!inBoard(targetRow, targetCol) || !inPalace(targetRow, targetCol, side)) continue
    pushIfLandable(board, side, targetRow, targetCol, moves)
  }
  const flyingTarget = findFlyingGeneralTarget(board, pos, side)
  if (flyingTarget) moves.push(flyingTarget)
  return moves
}

/** 根据格子上棋子的种类分发到对应的生成函数 */
export function generatePseudoLegalMoves(board: Board, pos: Position): Position[] {
  const piece = board[pos.row][pos.col]
  if (!piece) return []
  switch (piece.kind) {
    case 'R':
      return generateRookMoves(board, pos, piece.side)
    case 'C':
      return generateCannonMoves(board, pos, piece.side)
    case 'N':
      return generateHorseMoves(board, pos, piece.side)
    case 'B':
      return generateElephantMoves(board, pos, piece.side)
    case 'A':
      return generateAdvisorMoves(board, pos, piece.side)
    case 'K':
      return generateGeneralMoves(board, pos, piece.side)
    case 'P':
      return generateSoldierMoves(board, pos, piece.side)
    default:
      return []
  }
}
