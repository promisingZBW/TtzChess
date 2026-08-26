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
  moveToUcciCoord,
  opponentOf,
  parseFen,
  samePosition,
  STANDARD_START_FEN
} from '@shared/chess'
import type { Board, Position, Side } from '@shared/chess'
import { clickSandboxSquare, EMPTY_SANDBOX_SELECTION, type SandboxPosition } from './sandboxPlay'
import { winRatePercentFromPerspective } from './singlePositionAnalysis'
import type { EngineWdl } from '@shared/engine'

export interface GameHistoryEntry {
  fen: string
  board: Board
  sideToMove: Side
  /** 走到这一步的中文记谱，初始局面（第0个entry）没有走法，是null */
  moveNotation: string | null
  /** 走到这一步的 UCCI 坐标，收藏进案例库时用来还原棋谱树 */
  moveCoord: string | null
  /** 换算到固定视角后的胜率百分比；还在查询中是undefined，查询失败是null */
  winRatePercent: number | null | undefined
  /** 引擎原始WDL（当前走棋方视角）；查询中是undefined，失败是null */
  wdl: EngineWdl | null | undefined
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
  undoLastMove: () => void
  canUndo: boolean

  isSandbox: boolean
  toggleSandbox: () => void

  selection: SelectionState
  handleSquareClick: (pos: Position) => void
  board: Board
  sideToMove: Side
}

export function useFullGameAnalysis(): UseFullGameAnalysisResult {
  const [perspective, setPerspective] = useState<Side>('red')
  const [started, setStarted] = useState(false)
  const [history, setHistory] = useState<GameHistoryEntry[]>([])
  const [viewingIndex, setViewingIndex] = useState(0)
  const [selection, setSelection] = useState<SelectionState>(NO_SELECTION)
  const [sandbox, setSandbox] = useState<SandboxPosition | null>(null)

  function start(): void {
    const { board, sideToMove } = parseFen(STANDARD_START_FEN)
    const initialEntry: GameHistoryEntry = {
      fen: STANDARD_START_FEN,
      board,
      sideToMove,
      moveNotation: null,
      moveCoord: null,
      winRatePercent: undefined,
      wdl: undefined
    }
    setHistory([initialEntry])
    setViewingIndex(0)
    setSelection(NO_SELECTION)
    setSandbox(null)
    setStarted(true)
    void queryWinRate(0, initialEntry)
  }

  async function queryWinRate(index: number, entry: GameHistoryEntry): Promise<void> {
    try {
      const result = await window.chessoc.engine.analyzePosition(entry.fen)
      const percent = winRatePercentFromPerspective(result.wdl, entry.sideToMove, perspective)
      setHistory((prev) => {
        const next = [...prev]
        if (next[index]) next[index] = { ...next[index], winRatePercent: percent, wdl: result.wdl }
        return next
      })
    } catch {
      setHistory((prev) => {
        const next = [...prev]
        if (next[index]) next[index] = { ...next[index], winRatePercent: null, wdl: null }
        return next
      })
    }
  }

  function jumpToIndex(index: number): void {
    if (sandbox) return
    if (index < 0 || index >= history.length) return
    setViewingIndex(index)
    setSelection(NO_SELECTION)
  }

  function backToLatest(): void {
    jumpToIndex(history.length - 1)
  }

  function undoLastMove(): void {
    if (sandbox) return
    if (history.length <= 1) return
    const nextLength = history.length - 1
    setHistory((prev) => prev.slice(0, -1))
    setViewingIndex((prev) => Math.min(prev, nextLength - 1))
    setSelection(NO_SELECTION)
  }

  function toggleSandbox(): void {
    if (sandbox) {
      setSandbox(null)
    } else {
      const current = history[viewingIndex]
      if (!current) return
      setSandbox({
        board: current.board,
        sideToMove: current.sideToMove,
        selection: EMPTY_SANDBOX_SELECTION
      })
    }
    setSelection(NO_SELECTION)
  }

  function handleSquareClick(pos: Position): void {
    if (sandbox) {
      setSandbox(clickSandboxSquare(sandbox, pos))
      return
    }

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
    const coord = moveToUcciCoord(move)
    const nextBoard = applyMove(current.board, move)
    const nextSide = opponentOf(current.sideToMove)
    const nextFen = boardToFen(nextBoard, nextSide)
    const nextEntry: GameHistoryEntry = {
      fen: nextFen,
      board: nextBoard,
      sideToMove: nextSide,
      moveNotation: notation,
      moveCoord: coord,
      winRatePercent: undefined,
      wdl: undefined
    }

    setHistory((prev) => [...prev, nextEntry])
    setViewingIndex(history.length) // 新entry会排在当前history.length这个下标上
    void queryWinRate(history.length, nextEntry)
  }

  const viewingEntry = history[viewingIndex] ?? null
  const displayBoard = sandbox?.board ?? viewingEntry?.board ?? parseFen(STANDARD_START_FEN).board
  const displaySide = sandbox?.sideToMove ?? viewingEntry?.sideToMove ?? 'red'
  const displaySelection = sandbox?.selection ?? selection

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
    undoLastMove,
    canUndo: !sandbox && history.length > 1,
    isSandbox: sandbox !== null,
    toggleSandbox,
    selection: displaySelection,
    handleSquareClick,
    board: displayBoard,
    sideToMove: displaySide
  }
}
