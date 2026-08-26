// 单次分析页面（dev guide 7.1节）：左边空白棋盘随便摆局，右边展示分析结果，
// 复用阶段4/5已经写好的棋盘组件和拖拽摆子逻辑，但这里不接棋谱树/不落库——
// 分析用的局面只是临时的，关掉页面就没了，这和"打谱"是两回事。
// 沙盘演练可以在当前局面上试走，关掉后回到进入前的摆局，不会改掉待分析的正式局面。

import { useState } from 'react'
import { createEmptyBoard, setSquare } from '@shared/chess'
import type { Board, Piece, Position, Side } from '@shared/chess'
import { BoardView } from '../board/BoardView'
import type { PieceDragPayload } from '../study/dragTypes'
import { PlacementTray } from '../study/PlacementTray'
import { PlacementGhost } from '../study/PlacementGhost'
import { useKeyboardPlacement } from '../study/useKeyboardPlacement'
import { EngineStatusBanner } from './EngineStatusBanner'
import { SingleAnalysisResultsPanel } from './SingleAnalysisResultsPanel'
import { clickSandboxSquare, EMPTY_SANDBOX_SELECTION, type SandboxPosition } from './sandboxPlay'
import { runSinglePositionAnalysis, type SingleAnalysisResult } from './singlePositionAnalysis'
import { useEngineStatus } from './useEngineStatus'

interface SinglePositionAnalysisPageProps {
  onBack: () => void
}

interface AnalysisState {
  status: 'idle' | 'loading' | 'done' | 'error'
  result: SingleAnalysisResult | null
  error: string | null
}

const IDLE_STATE: AnalysisState = { status: 'idle', result: null, error: null }

export function SinglePositionAnalysisPage({ onBack }: SinglePositionAnalysisPageProps): React.JSX.Element {
  const [board, setBoard] = useState<Board>(createEmptyBoard())
  const [sideToMove, setSideToMove] = useState<Side>('red')
  const [sandbox, setSandbox] = useState<SandboxPosition | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisState>(IDLE_STATE)
  const engineStatus = useEngineStatus()
  const keyboard = useKeyboardPlacement(!sandbox)

  const hasAnyPiece = board.some((row) => row.some((square) => square !== null))
  const displayBoard = sandbox?.board ?? board
  const displaySide = sandbox?.sideToMove ?? sideToMove

  function placePiece(pos: Position, piece: Piece): void {
    if (sandbox) return
    setBoard((prev) => setSquare(prev, pos, piece))
  }

  function removePiece(pos: Position): void {
    if (sandbox) return
    setBoard((prev) => setSquare(prev, pos, null))
  }

  function handleDropPiece(pos: Position, payload: PieceDragPayload): void {
    if (sandbox) return
    if (payload.fromBoard) {
      if (payload.fromBoard.row === pos.row && payload.fromBoard.col === pos.col) return
      removePiece(payload.fromBoard)
    }
    placePiece(pos, { kind: payload.kind, side: payload.side })
  }

  function handleClearBoard(): void {
    if (sandbox) return
    setBoard(createEmptyBoard())
    setAnalysis(IDLE_STATE)
  }

  function toggleSandbox(): void {
    if (sandbox) {
      setSandbox(null)
      return
    }
    if (!hasAnyPiece) return
    setSandbox({ board, sideToMove, selection: EMPTY_SANDBOX_SELECTION })
  }

  function handleSandboxClick(pos: Position): void {
    if (!sandbox) return
    setSandbox(clickSandboxSquare(sandbox, pos))
  }

  async function handleStartAnalysis(): Promise<void> {
    setAnalysis({ status: 'loading', result: null, error: null })
    try {
      const result = await runSinglePositionAnalysis(
        displayBoard,
        displaySide,
        window.chessoc.engine.analyzePosition
      )
      setAnalysis({ status: 'done', result, error: null })
    } catch (err) {
      setAnalysis({ status: 'error', result: null, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div className="study-detail-page">
      <header className="study-toolbar">
        <button className="study-toolbar-back" onClick={onBack}>
          ← 返回
        </button>
        <h2 className="study-title">单次分析</h2>
        <div className="study-toolbar-right">
          <button
            className={sandbox ? 'sandbox-toggle sandbox-toggle-active' : 'sandbox-toggle'}
            onClick={toggleSandbox}
            disabled={!hasAnyPiece && !sandbox}
            title="开启后可以按规则试走，关闭后棋盘回到进入前的摆局"
          >
            {sandbox ? '退出沙盘演练' : '沙盘演练模式'}
          </button>
        </div>
      </header>

      <EngineStatusBanner status={engineStatus} />

      <div className="study-body">
        <div className="study-board-column">
          {!sandbox && (
            <PlacementTray
              onRemoveFromBoard={removePiece}
              heldPiece={keyboard.heldPiece}
              onSelectPiece={keyboard.setHeldPiece}
            />
          )}

          <div className="study-board-center">
            {sandbox ? (
              <p className="study-hint study-hint-sandbox">
                沙盘演练中：按规则试走不会改掉原来的摆局，关闭后棋盘回到进入前的状态
              </p>
            ) : (
              <p className="analysis-hint">摆出想分析的局面，选好轮到哪一方走棋，再点"开始分析"。</p>
            )}

            <BoardView
              board={displayBoard}
              selected={sandbox?.selection.selected ?? null}
              legalTargets={sandbox?.selection.legalTargets ?? []}
              onSquareClick={
                sandbox
                  ? handleSandboxClick
                  : keyboard.heldPiece
                    ? (pos) => placePiece(pos, keyboard.heldPiece as Piece)
                    : undefined
              }
              placement={sandbox ? undefined : { onDropPiece: handleDropPiece, onRemovePiece: removePiece }}
            />
            {!sandbox && keyboard.heldPiece && (
              <PlacementGhost piece={keyboard.heldPiece} pointer={keyboard.pointer} />
            )}

            <div className="analysis-controls">
              <label className="analysis-side-radio">
                <input
                  type="radio"
                  name="side-to-move"
                  checked={sideToMove === 'red'}
                  onChange={() => setSideToMove('red')}
                  disabled={Boolean(sandbox)}
                />
                轮到红方走
              </label>
              <label className="analysis-side-radio">
                <input
                  type="radio"
                  name="side-to-move"
                  checked={sideToMove === 'black'}
                  onChange={() => setSideToMove('black')}
                  disabled={Boolean(sandbox)}
                />
                轮到黑方走
              </label>
              <button onClick={handleClearBoard} disabled={Boolean(sandbox)}>
                清空棋盘
              </button>
              <button
                className="analysis-start-button"
                onClick={handleStartAnalysis}
                disabled={!hasAnyPiece || analysis.status === 'loading'}
              >
                {analysis.status === 'loading' ? '分析中…' : '开始分析'}
              </button>
            </div>
          </div>
        </div>

        <div className="analysis-panel-column">
          <SingleAnalysisResultsPanel status={analysis.status} result={analysis.result} error={analysis.error} />
        </div>
      </div>
    </div>
  )
}
