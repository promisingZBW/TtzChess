// 阶段2的核心状态管理：维护"当前棋盘 + 轮到谁走 + 选中的棋子 + 走法记录"，
// 并把点击事件翻译成"选中 / 切换选中 / 走子 / 非法走法提示"这几种结果。
// 这个hook只依赖阶段1的规则引擎，不涉及棋谱树、本地存储，符合阶段2"只验证点击交互+规则引擎联动"的范围。

import { useCallback, useMemo, useState } from 'react'
import {
  applyMove,
  createInitialBoard,
  getGameStatus,
  getLegalMovesFrom,
  isLegalMove,
  moveToChineseNotation,
  samePosition
} from '@shared/chess'
import type { Board, GameStatus, Move, Position, Side } from '@shared/chess'

export interface MoveLogEntry {
  side: Side
  notation: string
}

interface GameState {
  board: Board
  sideToMove: Side
  selected: Position | null
  legalTargets: Position[]
  moveLog: MoveLogEntry[]
  rejectedMessage: string | null
}

function createInitialState(): GameState {
  return {
    board: createInitialBoard(),
    sideToMove: 'red',
    selected: null,
    legalTargets: [],
    moveLog: [],
    rejectedMessage: null
  }
}

export interface XiangqiGame {
  board: Board
  sideToMove: Side
  selected: Position | null
  legalTargets: Position[]
  moveLog: MoveLogEntry[]
  rejectedMessage: string | null
  status: GameStatus
  isGameOver: boolean
  handleSquareClick: (pos: Position) => void
  reset: () => void
}

export function useXiangqiGame(): XiangqiGame {
  const [state, setState] = useState<GameState>(createInitialState)

  const status = useMemo(
    () => getGameStatus(state.board, state.sideToMove),
    [state.board, state.sideToMove]
  )
  const isGameOver = status === 'checkmate' || status === 'stalemate'

  const reset = useCallback(() => setState(createInitialState()), [])

  const handleSquareClick = useCallback((pos: Position) => {
    setState((prev) => {
      const currentStatus = getGameStatus(prev.board, prev.sideToMove)
      if (currentStatus === 'checkmate' || currentStatus === 'stalemate') {
        return prev // 一方已经赢了，棋盘不再响应点击
      }

      const clickedPiece = prev.board[pos.row][pos.col]
      const clickedOwnPiece = clickedPiece && clickedPiece.side === prev.sideToMove

      // 还没选中棋子 或者 点击了自己另一颗棋子：选中/切换选中
      if (!prev.selected || clickedOwnPiece) {
        if (!clickedOwnPiece) return prev // 没选中任何子的情况下点了对方棋子或空格，忽略
        const legalTargets = getLegalMovesFrom(prev.board, pos).map((move) => move.to)
        return { ...prev, selected: pos, legalTargets, rejectedMessage: null }
      }

      // 再次点击已选中的格子：取消选中
      if (samePosition(prev.selected, pos)) {
        return { ...prev, selected: null, legalTargets: [], rejectedMessage: null }
      }

      // 尝试把选中的棋子走到点击的格子
      const move: Move = { from: prev.selected, to: pos }
      if (!isLegalMove(prev.board, move)) {
        return { ...prev, selected: null, legalTargets: [], rejectedMessage: '不合法的走法，请重新选择' }
      }

      const notation = moveToChineseNotation(prev.board, move)
      const nextBoard = applyMove(prev.board, move)
      const nextSide: Side = prev.sideToMove === 'red' ? 'black' : 'red'

      return {
        board: nextBoard,
        sideToMove: nextSide,
        selected: null,
        legalTargets: [],
        moveLog: [...prev.moveLog, { side: prev.sideToMove, notation }],
        rejectedMessage: null
      }
    })
  }, [])

  return {
    board: state.board,
    sideToMove: state.sideToMove,
    selected: state.selected,
    legalTargets: state.legalTargets,
    moveLog: state.moveLog,
    rejectedMessage: state.rejectedMessage,
    status,
    isGameOver,
    handleSquareClick,
    reset
  }
}
