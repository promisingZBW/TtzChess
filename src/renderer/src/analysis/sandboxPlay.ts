// 沙盘里点格子走子的纯逻辑：和打谱页同一套选子→落子规则，但不写棋谱树。
// 单次分析、整局分析共用，避免两处各抄一份点击状态机。

import { applyMove, getLegalMovesFrom, isLegalMove, opponentOf, samePosition } from '@shared/chess'
import type { Board, Position, Side } from '@shared/chess'

export interface SandboxSelection {
  selected: Position | null
  legalTargets: Position[]
}

export const EMPTY_SANDBOX_SELECTION: SandboxSelection = { selected: null, legalTargets: [] }

export interface SandboxPosition {
  board: Board
  sideToMove: Side
  selection: SandboxSelection
}

export function clickSandboxSquare(state: SandboxPosition, pos: Position): SandboxPosition {
  const clickedPiece = state.board[pos.row][pos.col]
  const clickedOwnPiece = clickedPiece !== null && clickedPiece.side === state.sideToMove

  if (!state.selection.selected || clickedOwnPiece) {
    if (!clickedOwnPiece) return state
    const legalTargets = getLegalMovesFrom(state.board, pos).map((m) => m.to)
    return { ...state, selection: { selected: pos, legalTargets } }
  }

  if (samePosition(state.selection.selected, pos)) {
    return { ...state, selection: EMPTY_SANDBOX_SELECTION }
  }

  const move = { from: state.selection.selected, to: pos }
  if (!isLegalMove(state.board, move)) {
    return { ...state, selection: EMPTY_SANDBOX_SELECTION }
  }

  return {
    board: applyMove(state.board, move),
    sideToMove: opponentOf(state.sideToMove),
    selection: EMPTY_SANDBOX_SELECTION
  }
}
