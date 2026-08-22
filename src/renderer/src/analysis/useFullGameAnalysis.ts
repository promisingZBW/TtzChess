// 整局分析（dev guide 7.2节）的状态管理：用户选好视角后，从标准开局起始局面开始，
// 自己一步步把一整局真实棋谱走出来（不是分析假设局面），每走一步就查一次引擎胜率，
// 累积成一条折线；折线上的历史点可以点击跳回去看，也可以在任意历史点触发一次完整的单次分析。

import { useState } from 'react'
import {
  applyMove,
  boardToFen,
  getLegalMovesFrom,
  isLegalMove,
  moveToChineseNotation,
  opponentOf,
  parseFen,
  samePosition,
  STANDARD_START_FEN
} from '@shared/chess'
import type { Board, Position, Side } from '@shared/chess'
import { winRatePercentFromPerspective } from './singlePositionAnalysis'

export interface GameHistoryEntry {
  fen: string
  board: Board
  sideToMove: Side
  /** 走到这一步的中文记谱，初始局面（第0个entry）没有走法，是null */
  moveNotation: string | null
  /** 换算到固定视角后的胜率百分比；还在查询中是undefined，查询失败是null */
  winRatePercent: number | null | undefined
}

interface SelectionState {
  selected: Position | null
  legalTargets: Position[]
}

const NO_SELECTION: SelectionState = { selected: null, legalTargets: [] }

export interface UseFullGameAnalysisResult {
  started: boolean
  perspective: Side
  setPerspective: (side: Side) => void
  start: () => void

  history: GameHistoryEntry[]
  viewingIndex: number
  viewingEntry: GameHistoryEntry | null
  isAtLatest: boolean
  jumpToIndex: (index: number) => void
  backToLatest: () => void

  selection: SelectionState
  handleSquareClick: (pos: Position) => void
}

export function useFullGameAnalysis(): UseFullGameAnalysisResult {
  const [perspective, setPerspective] = useState<Side>('red')
  const [started, setStarted] = useState(false)
  const [history, setHistory] = useState<GameHistoryEntry[]>([])
  const [viewingIndex, setViewingIndex] = useState(0)
  const [selection, setSelection] = useState<SelectionState>(NO_SELECTION)

  function start(): void {
    const { board, sideToMove } = parseFen(STANDARD_START_FEN)
    const initialEntry: GameHistoryEntry = {
      fen: STANDARD_START_FEN,
      board,
      sideToMove,
      moveNotation: null,
      winRatePercent: undefined
    }
    setHistory([initialEntry])
    setViewingIndex(0)
    setSelection(NO_SELECTION)
    setStarted(true)
    void queryWinRate(0, initialEntry)
  }

  async function queryWinRate(index: number, entry: GameHistoryEntry): Promise<void> {
    try {
      const result = await window.chessoc.engine.analyzePosition(entry.fen)
      const percent = winRatePercentFromPerspective(result.wdl, entry.sideToMove, perspective)
      setHistory((prev) => {
        const next = [...prev]
        if (next[index]) next[index] = { ...next[index], winRatePercent: percent }
        return next
      })
    } catch {
      setHistory((prev) => {
        const next = [...prev]
        if (next[index]) next[index] = { ...next[index], winRatePercent: null }
        return next
      })
    }
  }

  function jumpToIndex(index: number): void {
    if (index < 0 || index >= history.length) return
    setViewingIndex(index)
    setSelection(NO_SELECTION)
  }

  function backToLatest(): void {
    jumpToIndex(history.length - 1)
  }

  function handleSquareClick(pos: Position): void {
    const isAtLatest = viewingIndex === history.length - 1
    if (!started || !isAtLatest) return
    const current = history[viewingIndex]
    if (!current) return

    const clickedPiece = current.board[pos.row][pos.col]
    const clickedOwnPiece = clickedPiece !== null && clickedPiece.side === current.sideToMove

    if (!selection.selected || clickedOwnPiece) {
      if (!clickedOwnPiece) return
      const legalTargets = getLegalMovesFrom(current.board, pos).map((m) => m.to)
      setSelection({ selected: pos, legalTargets })
      return
    }

    if (samePosition(selection.selected, pos)) {
      setSelection(NO_SELECTION)
      return
    }

    const move = { from: selection.selected, to: pos }
    if (!isLegalMove(current.board, move)) {
      setSelection(NO_SELECTION)
      return
    }

    setSelection(NO_SELECTION)
    const notation = moveToChineseNotation(current.board, move)
    const nextBoard = applyMove(current.board, move)
    const nextSide = opponentOf(current.sideToMove)
    const nextFen = boardToFen(nextBoard, nextSide)
    const nextEntry: GameHistoryEntry = {
      fen: nextFen,
      board: nextBoard,
      sideToMove: nextSide,
      moveNotation: notation,
      winRatePercent: undefined
    }

    setHistory((prev) => [...prev, nextEntry])
    setViewingIndex(history.length) // 新entry会排在当前history.length这个下标上
    void queryWinRate(history.length, nextEntry)
  }

  const viewingEntry = history[viewingIndex] ?? null

  return {
    started,
    perspective,
    setPerspective,
    start,
    history,
    viewingIndex,
    viewingEntry,
    isAtLatest: viewingIndex === history.length - 1,
    jumpToIndex,
    backToLatest,
    selection,
    handleSquareClick
  }
}
