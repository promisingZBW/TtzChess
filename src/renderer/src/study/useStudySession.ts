// 打谱详情界面的核心状态管理。这一个hook管了dev guide第5节里说的几乎所有状态：
// - 棋谱树缓存（从IPC读回来的 id->MoveNode 映射，走一步棋/加笔记都会同步更新这份缓存）
// - "当前在看哪一步"的前进后退历史（activePath + cursorIndex，逻辑类似浏览器的前进后退）
// - 沙盘演练模式（单独一小块状态，开关沙盘不会污染正式棋谱树，关闭后自动回到进入前的局面）
// - 摆局阶段 vs 打谱阶段（只有从空白棋盘开始的案例才有摆局阶段，开局棋路直接就是打谱阶段）
//
// 不在这里做的事：右键菜单的开关状态、笔记输入框的文本框状态——这些是纯UI交互细节，
// 留给 MoveTreePanel 自己用 useState 管，这个hook只暴露"读笔记/存笔记"这两个动作。

import { useEffect, useMemo, useState } from 'react'
import {
  applyMove,
  boardToFen,
  createEmptyBoard,
  EMPTY_BOARD_FEN,
  getLegalMovesFrom,
  isLegalMove,
  moveToChineseNotation,
  moveToUcciCoord,
  opponentOf,
  parseFen,
  samePosition,
  setSquare
} from '@shared/chess'
import type { Board, Piece, Position, Side } from '@shared/chess'
import type { MoveNode } from '@shared/moveTree'
import { collectSubtreeIds, computePathFromRoot, nextForwardNodeId } from './moveTreeUtils'

export interface StudySubjectRef {
  kind: 'opening' | 'case'
  id: string
}

interface LoadedSubject {
  kind: 'opening' | 'case'
  id: string
  title: string
  rootNodeId: string
}

type SessionMode = 'placing' | 'recording'

interface SandboxState {
  entryNodeId: string
  board: Board
  sideToMove: Side
}

interface SelectionState {
  selected: Position | null
  legalTargets: Position[]
}

const NO_SELECTION: SelectionState = { selected: null, legalTargets: [] }

export interface UseStudySessionResult {
  loading: boolean
  error: string | null
  subject: LoadedSubject | null
  mode: SessionMode
  nodes: Map<string, MoveNode>
  rootNodeId: string | null

  // 当前棋盘（受摆局/沙盘影响，见上面注释）
  board: Board
  sideToMove: Side
  selection: SelectionState

  // 前进后退（只作用于官方棋谱树，沙盘期间被锁定）
  activePath: string[]
  cursorIndex: number
  currentNodeId: string | null
  canGoBack: boolean
  canGoForward: boolean
  goBack: () => void
  goForward: () => void
  jumpToNode: (nodeId: string) => void
  deleteNode: (nodeId: string) => Promise<void>

  // 走子
  handleSquareClick: (pos: Position) => void

  // 沙盘模式
  isSandbox: boolean
  toggleSandbox: () => void

  // 笔记
  setNoteText: (nodeId: string, text: string | null) => Promise<void>

  // 保存
  save: () => Promise<void>
  saveStatus: 'idle' | 'saving' | 'saved'

  // 摆局阶段专属
  placePiece: (pos: Position, piece: Piece) => void
  removePlacedPiece: (pos: Position) => void
  startRecording: () => Promise<void>
}

export function useStudySession(subjectRef: StudySubjectRef): UseStudySessionResult {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subject, setSubject] = useState<LoadedSubject | null>(null)
  const [nodes, setNodes] = useState<Map<string, MoveNode>>(new Map())
  const [mode, setMode] = useState<SessionMode>('recording')
  const [placingBoard, setPlacingBoard] = useState<Board>(createEmptyBoard())
  const [activePath, setActivePath] = useState<string[]>([])
  const [cursorIndex, setCursorIndex] = useState(0)
  const [sandbox, setSandbox] = useState<SandboxState | null>(null)
  const [selection, setSelection] = useState<SelectionState>(NO_SELECTION)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      setLoading(true)
      setError(null)
      try {
        let loaded: LoadedSubject
        if (subjectRef.kind === 'opening') {
          const study = await window.chessoc.moveTree.getOpeningStudy(subjectRef.id)
          if (!study) throw new Error('找不到这条开局棋路，可能已被删除。')
          loaded = { kind: 'opening', id: study.id, title: study.title, rootNodeId: study.rootNode.id }
        } else {
          const studyCase = await window.chessoc.moveTree.getStudyCase(subjectRef.id)
          if (!studyCase) throw new Error('找不到这个案例，可能已被删除。')
          loaded = { kind: 'case', id: studyCase.id, title: studyCase.title, rootNodeId: studyCase.rootNode.id }
        }

        const treeNodes = await window.chessoc.moveTree.loadTree(loaded.rootNodeId)
        if (cancelled) return

        const map = new Map(treeNodes.map((n) => [n.id, n] as const))
        const rootNode = map.get(loaded.rootNodeId)
        // 案例的根节点还是初始的空白棋盘、且还没有任何走法时，说明摆局阶段还没结束
        const initialMode: SessionMode =
          loaded.kind === 'case' &&
          rootNode &&
          rootNode.boardStateFEN === EMPTY_BOARD_FEN &&
          rootNode.childrenIds.length === 0
            ? 'placing'
            : 'recording'

        setSubject(loaded)
        setNodes(map)
        setMode(initialMode)
        setPlacingBoard(createEmptyBoard())
        setActivePath([loaded.rootNodeId])
        setCursorIndex(0)
        setSandbox(null)
        setSelection(NO_SELECTION)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [subjectRef.kind, subjectRef.id])

  const currentNodeId = activePath.length > 0 ? activePath[cursorIndex] : null
  const currentNode = currentNodeId ? (nodes.get(currentNodeId) ?? null) : null

  const board = useMemo<Board>(() => {
    if (mode === 'placing') return placingBoard
    if (sandbox) return sandbox.board
    if (!currentNode) return createEmptyBoard()
    return parseFen(currentNode.boardStateFEN).board
  }, [mode, placingBoard, sandbox, currentNode])

  const sideToMove = useMemo<Side>(() => {
    if (mode === 'placing') return 'red'
    if (sandbox) return sandbox.sideToMove
    if (!currentNode) return 'red'
    return parseFen(currentNode.boardStateFEN).sideToMove
  }, [mode, sandbox, currentNode])

  async function handleSquareClick(pos: Position): Promise<void> {
    if (mode !== 'recording' || !subject || !currentNode) return

    const clickedPiece = board[pos.row][pos.col]
    const clickedOwnPiece = clickedPiece !== null && clickedPiece.side === sideToMove

    if (!selection.selected || clickedOwnPiece) {
      if (!clickedOwnPiece) return
      const legalTargets = getLegalMovesFrom(board, pos).map((m) => m.to)
      setSelection({ selected: pos, legalTargets })
      return
    }

    if (samePosition(selection.selected, pos)) {
      setSelection(NO_SELECTION)
      return
    }

    const move = { from: selection.selected, to: pos }
    if (!isLegalMove(board, move)) {
      setSelection(NO_SELECTION)
      return
    }

    setSelection(NO_SELECTION)

    const notation = moveToChineseNotation(board, move)
    const nextBoard = applyMove(board, move)
    const nextSide = opponentOf(sideToMove)
    const nextFEN = boardToFen(nextBoard, nextSide)

    if (sandbox) {
      // 沙盘模式：只更新沙盘覆盖层，不产生任何持久化写入
      setSandbox({ ...sandbox, board: nextBoard, sideToMove: nextSide })
      return
    }

    const coord = moveToUcciCoord(move)
    const existingChild = currentNode.childrenIds
      .map((id) => nodes.get(id))
      .find((n): n is MoveNode => Boolean(n) && n!.moveCoord === coord)

    let targetNode: MoveNode
    if (existingChild) {
      // 走出了一步和已有分支完全相同的棋，直接跳进那个分支，不重复创建节点
      targetNode = existingChild
    } else {
      targetNode = await window.chessoc.moveTree.createMoveNode({
        parentId: currentNode.id,
        move: notation,
        moveCoord: coord,
        boardStateFEN: nextFEN
      })
      setNodes((prev) => {
        const next = new Map(prev)
        next.set(targetNode.id, targetNode)
        const parent = next.get(currentNode.id)
        if (parent && !parent.childrenIds.includes(targetNode.id)) {
          next.set(currentNode.id, { ...parent, childrenIds: [...parent.childrenIds, targetNode.id] })
        }
        return next
      })
    }

    setActivePath((prev) => [...prev.slice(0, cursorIndex + 1), targetNode.id])
    setCursorIndex((prev) => prev + 1)
  }

  function goBack(): void {
    if (sandbox) return
    setCursorIndex((prev) => Math.max(0, prev - 1))
    setSelection(NO_SELECTION)
  }

  function goForward(): void {
    if (sandbox) return
    const nextId = nextForwardNodeId(nodes, activePath, cursorIndex)
    if (!nextId) return
    if (cursorIndex < activePath.length - 1) {
      setCursorIndex((prev) => prev + 1)
    } else {
      setActivePath((prev) => [...prev, nextId])
      setCursorIndex((prev) => prev + 1)
    }
    setSelection(NO_SELECTION)
  }

  function jumpToNode(nodeId: string): void {
    if (sandbox) return // 沙盘模式下棋谱树导航被锁定：想跳转要先关掉沙盘
    const path = computePathFromRoot(nodes, nodeId)
    if (path.length === 0) return
    setActivePath(path)
    setCursorIndex(path.length - 1)
    setSelection(NO_SELECTION)
  }

  async function deleteNode(nodeId: string): Promise<void> {
    const target = nodes.get(nodeId)
    if (!target || target.parentId === null) return

    await window.chessoc.moveTree.deleteMoveNode(nodeId)

    const removedIds = new Set(collectSubtreeIds(nodes, nodeId))
    const parentId = target.parentId
    const nextNodes = new Map(nodes)
    for (const id of removedIds) nextNodes.delete(id)
    const parent = nextNodes.get(parentId)
    if (parent) {
      nextNodes.set(parentId, {
        ...parent,
        childrenIds: parent.childrenIds.filter((id) => id !== nodeId)
      })
    }
    setNodes(nextNodes)

    const fallbackId = currentNodeId && removedIds.has(currentNodeId) ? parentId : (currentNodeId ?? parentId)
    const path = computePathFromRoot(nextNodes, fallbackId ?? parentId)
    setActivePath(path)
    setCursorIndex(Math.max(0, path.length - 1))
    setSelection(NO_SELECTION)
  }

  function toggleSandbox(): void {
    if (mode !== 'recording' || !currentNode) return
    if (sandbox) {
      // 关闭沙盘：官方的activePath/cursorIndex从头到尾都没变过，直接扔掉沙盘覆盖层即可自动回到原局面
      setSandbox(null)
    } else {
      const { board: entryBoard, sideToMove: entrySide } = parseFen(currentNode.boardStateFEN)
      setSandbox({ entryNodeId: currentNode.id, board: entryBoard, sideToMove: entrySide })
    }
    setSelection(NO_SELECTION)
  }

  async function setNoteText(nodeId: string, text: string | null): Promise<void> {
    const updated = await window.chessoc.moveTree.setNote(nodeId, text)
    if (!updated) return
    setNodes((prev) => {
      const next = new Map(prev)
      next.set(nodeId, updated)
      return next
    })
  }

  async function save(): Promise<void> {
    if (!subject) return
    setSaveStatus('saving')
    if (subject.kind === 'opening') {
      await window.chessoc.moveTree.touchOpeningStudy(subject.id)
    } else {
      await window.chessoc.moveTree.touchStudyCase(subject.id)
    }
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
  }

  function placePiece(pos: Position, piece: Piece): void {
    setPlacingBoard((prev) => setSquare(prev, pos, piece))
  }

  function removePlacedPiece(pos: Position): void {
    setPlacingBoard((prev) => setSquare(prev, pos, null))
  }

  async function startRecording(): Promise<void> {
    if (!subject || mode !== 'placing') return
    const fen = boardToFen(placingBoard, 'red')
    const updated = await window.chessoc.moveTree.updateBoardState(subject.rootNodeId, fen)
    if (!updated) return
    setNodes((prev) => {
      const next = new Map(prev)
      next.set(updated.id, updated)
      return next
    })
    setMode('recording')
  }

  return {
    loading,
    error,
    subject,
    mode,
    nodes,
    rootNodeId: subject?.rootNodeId ?? null,

    board,
    sideToMove,
    selection,

    activePath,
    cursorIndex,
    currentNodeId,
    canGoBack: !sandbox && cursorIndex > 0,
    canGoForward: !sandbox && nextForwardNodeId(nodes, activePath, cursorIndex) !== null,
    goBack,
    goForward,
    jumpToNode,
    deleteNode,

    handleSquareClick,

    isSandbox: sandbox !== null,
    toggleSandbox,

    setNoteText,

    save,
    saveStatus,

    placePiece,
    removePlacedPiece,
    startRecording
  }
}
