// 沙盘里点格子走子的纯逻辑：和打谱页同一套选子→落子规则，但不写棋谱树。
// 打谱页、单次分析、整局分析三处共用，避免各抄一份点击状态机。
//
// 沙盘自己存一条走法历史（history + cursor），这样试变化的时候也能前进后退：
// 走错一步不用退出沙盘重来，退一步接着试就行。history[0] 永远是进入沙盘时的那个局面，
// 所以一路退到底就回到了起点。逻辑和浏览器的前进后退一样——退回去之后再走一步新的，
// 原来那条"未来"就被丢掉，从当前这步重新往后接。

import { applyMove, getLegalMovesFrom, isLegalMove, opponentOf, samePosition } from '@shared/chess'
import type { Board, Position, Side } from '@shared/chess'

export interface SandboxSelection {
  selected: Position | null
  legalTargets: Position[]
}

export const EMPTY_SANDBOX_SELECTION: SandboxSelection = { selected: null, legalTargets: [] }

/** 沙盘历史里的一格：走完某一步之后的局面 */
export interface SandboxFrame {
  board: Board
  sideToMove: Side
}

export interface SandboxPosition {
  /** 至少有一项；[0] 是进入沙盘时的局面 */
  history: SandboxFrame[]
  /** 当前看的是 history 里的第几格 */
  cursor: number
  selection: SandboxSelection
}

export function createSandbox(board: Board, sideToMove: Side): SandboxPosition {
  return { history: [{ board, sideToMove }], cursor: 0, selection: EMPTY_SANDBOX_SELECTION }
}

export function sandboxFrame(state: SandboxPosition): SandboxFrame {
  return state.history[state.cursor]
}

export function canSandboxGoBack(state: SandboxPosition): boolean {
  return state.cursor > 0
}

export function canSandboxGoForward(state: SandboxPosition): boolean {
  return state.cursor < state.history.length - 1
}

export function sandboxGoBack(state: SandboxPosition): SandboxPosition {
  if (!canSandboxGoBack(state)) return state
  return { ...state, cursor: state.cursor - 1, selection: EMPTY_SANDBOX_SELECTION }
}

export function sandboxGoForward(state: SandboxPosition): SandboxPosition {
  if (!canSandboxGoForward(state)) return state
  return { ...state, cursor: state.cursor + 1, selection: EMPTY_SANDBOX_SELECTION }
}

/** 这次点击产生了什么，调用方拿它决定放哪个音效；没走成子就是 null */
export interface SandboxClickOutcome {
  captured: boolean
}

export interface SandboxClickResult {
  state: SandboxPosition
  moved: SandboxClickOutcome | null
}

export function clickSandboxSquare(state: SandboxPosition, pos: Position): SandboxClickResult {
  const { board, sideToMove } = sandboxFrame(state)
  const clickedPiece = board[pos.row][pos.col]
  const clickedOwnPiece = clickedPiece !== null && clickedPiece.side === sideToMove

  if (!state.selection.selected || clickedOwnPiece) {
    if (!clickedOwnPiece) return { state, moved: null }
    const legalTargets = getLegalMovesFrom(board, pos).map((m) => m.to)
    return { state: { ...state, selection: { selected: pos, legalTargets } }, moved: null }
  }

  if (samePosition(state.selection.selected, pos)) {
    return { state: { ...state, selection: EMPTY_SANDBOX_SELECTION }, moved: null }
  }

  const move = { from: state.selection.selected, to: pos }
  if (!isLegalMove(board, move)) {
    return { state: { ...state, selection: EMPTY_SANDBOX_SELECTION }, moved: null }
  }

  const captured = board[pos.row][pos.col] !== null
  // 退回去几步之后又走了新的一步：把原来那条"未来"丢掉，从当前这步往后接
  const history = [
    ...state.history.slice(0, state.cursor + 1),
    { board: applyMove(board, move), sideToMove: opponentOf(sideToMove) }
  ]

  return {
    state: { history, cursor: history.length - 1, selection: EMPTY_SANDBOX_SELECTION },
    moved: { captured }
  }
}
