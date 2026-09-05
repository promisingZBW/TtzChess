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
  /** 开局棋路没有摆局阶段，恒为true；中局/残局案例读数据库里的标记 */
  setupCompleted: boolean
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

  // 回到摆局阶段改起始局面（只有案例有摆局阶段，开局棋路用不到）
  canRestartPlacement: boolean
  /** 重新摆局会不会牵连已经记好的走法：根节点底下还挂着走法时为true，UI要先二次确认 */
  restartPlacementDropsMoves: boolean
  restartPlacement: () => Promise<void>
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
          loaded = {
            kind: 'opening',
            id: study.id,
            title: study.title,
            rootNodeId: study.rootNode.id,
            setupCompleted: true
          }
        } else {
          const studyCase = await window.chessoc.moveTree.getStudyCase(subjectRef.id)
          if (!studyCase) throw new Error('找不到这个案例，可能已被删除。')
          loaded = {
            kind: 'case',
            id: studyCase.id,
            title: studyCase.title,
            rootNodeId: studyCase.rootNode.id,
            setupCompleted: studyCase.setupCompleted
          }
        }

        const treeNodes = await window.chessoc.moveTree.loadTree(loaded.rootNodeId)
        if (cancelled) return

        const map = new Map(treeNodes.map((n) => [n.id, n] as const))
        const rootNode = map.get(loaded.rootNodeId)
        // 摆局有没有结束由数据库里的标记说了算，不再从根节点局面反推——摆到一半点保存时，
        // 摆好的子同样会写进根节点，只靠局面判断会把这种情况误判成"摆局已经结束"。
        const initialMode: SessionMode = loaded.setupCompleted ? 'recording' : 'placing'

        setSubject(loaded)
        setNodes(map)
        setMode(initialMode)
        // 上次摆到一半保存过就接着上次摆，没存过就是一张空棋盘
        setPlacingBoard(
          initialMode === 'placing' && rootNode && rootNode.boardStateFEN !== EMPTY_BOARD_FEN
            ? parseFen(rootNode.boardStateFEN).board
            : createEmptyBoard()
        )
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
  const rootChildCount = subject ? (nodes.get(subject.rootNodeId)?.childrenIds.length ?? 0) : 0

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

  /** 把根节点的新局面同步进本地缓存，省得为了一个字段重新拉一次整棵树 */
  function patchRootBoardState(rootNodeId: string, fen: string): void {
    setNodes((prev) => {
      const root = prev.get(rootNodeId)
      if (!root) return prev
      const next = new Map(prev)
      next.set(rootNodeId, { ...root, boardStateFEN: fen })
      return next
    })
  }

  async function save(): Promise<void> {
    if (!subject) return
    setSaveStatus('saving')
    if (subject.kind === 'opening') {
      await window.chessoc.moveTree.touchOpeningStudy(subject.id)
    } else if (mode === 'placing') {
      // 摆局阶段的"保存"必须把摆好的子真的写进根节点。以前这里只更新了时间戳，
      // 摆好的局面只活在 placingBoard 这个React state里，关掉程序就没了。
      const fen = boardToFen(placingBoard, 'red')
      await window.chessoc.moveTree.saveStudyCaseSetup(subject.id, fen, false)
      patchRootBoardState(subject.rootNodeId, fen)
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
    const updated = await window.chessoc.moveTree.saveStudyCaseSetup(subject.id, fen, true)
    if (!updated) return
    setSubject({ ...subject, setupCompleted: true })
    patchRootBoardState(subject.rootNodeId, fen)
    setActivePath([subject.rootNodeId])
    setCursorIndex(0)
    setSelection(NO_SELECTION)
    setMode('recording')
  }

  /**
   * 回到摆局阶段修改起始局面。已经记好的走法是在旧起始局面上一步步推出来的，换了起始局面
   * 就全对不上号了（那些节点存的FEN还是旧局面推出来的），所以这里连带把根节点底下的走法一起删掉。
   * UI 侧要先用 restartPlacementDropsMoves 判断需不需要二次确认，别让用户在不知情的情况下丢棋谱。
   */
  async function restartPlacement(): Promise<void> {
    if (!subject || subject.kind !== 'case' || mode !== 'recording') return

    const root = nodes.get(subject.rootNodeId)
    if (!root) return

    for (const childId of root.childrenIds) {
      await window.chessoc.moveTree.deleteMoveNode(childId)
    }
    await window.chessoc.moveTree.saveStudyCaseSetup(subject.id, null, false)

    setPlacingBoard(parseFen(root.boardStateFEN).board)
    setNodes(new Map([[root.id, { ...root, childrenIds: [] }]]))
    setSubject({ ...subject, setupCompleted: false })
    setActivePath([subject.rootNodeId])
    setCursorIndex(0)
    setSandbox(null)
    setSelection(NO_SELECTION)
    setMode('placing')
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
    startRecording,

    canRestartPlacement: subject?.kind === 'case' && mode === 'recording' && sandbox === null,
    restartPlacementDropsMoves: rootChildCount > 0,
    restartPlacement
  }
}
