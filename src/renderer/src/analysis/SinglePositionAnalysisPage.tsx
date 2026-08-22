// 单次分析页面（dev guide 7.1节）：左边空白棋盘随便摆局，右边展示分析结果，
// 复用阶段4/5已经写好的棋盘组件和拖拽摆子逻辑，但这里不接棋谱树/不落库——
// 分析用的局面只是临时的，关掉页面就没了，这和"打谱"是两回事。

import { useState } from 'react'
import { createEmptyBoard, setSquare } from '@shared/chess'
import type { Board, Piece, Position, Side } from '@shared/chess'
import { BoardView } from '../board/BoardView'
import type { PieceDragPayload } from '../study/dragTypes'
import { PlacementTray } from '../study/PlacementTray'
import { EngineStatusBanner } from './EngineStatusBanner'
import { SingleAnalysisResultsPanel } from './SingleAnalysisResultsPanel'
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
  const [analysis, setAnalysis] = useState<AnalysisState>(IDLE_STATE)
  const engineStatus = useEngineStatus()

  const hasAnyPiece = board.some((row) => row.some((square) => square !== null))

  function placePiece(pos: Position, piece: Piece): void {
    setBoard((prev) => setSquare(prev, pos, piece))
  }

  function removePiece(pos: Position): void {
    setBoard((prev) => setSquare(prev, pos, null))
  }

  function handleDropPiece(pos: Position, payload: PieceDragPayload): void {
    if (payload.fromBoard) {
      if (payload.fromBoard.row === pos.row && payload.fromBoard.col === pos.col) return
      removePiece(payload.fromBoard)
    }
    placePiece(pos, { kind: payload.kind, side: payload.side })
  }

  function handleClearBoard(): void {
    setBoard(createEmptyBoard())
    setAnalysis(IDLE_STATE)
  }

  async function handleStartAnalysis(): Promise<void> {
    setAnalysis({ status: 'loading', result: null, error: null })
    try {
      const result = await runSinglePositionAnalysis(board, sideToMove, window.chessoc.engine.analyzePosition)
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
      </header>

      <EngineStatusBanner status={engineStatus} />

      <div className="study-body">
        <div className="study-board-column">
          <PlacementTray onRemoveFromBoard={removePiece} />

          <div className="study-board-center">
            <p className="analysis-hint">摆出想分析的局面，选好轮到哪一方走棋，再点"开始分析"。</p>

            <BoardView
              board={board}
              selected={null}
              legalTargets={[]}
              placement={{ onDropPiece: handleDropPiece, onRemovePiece: removePiece }}
            />

            <div className="analysis-controls">
              <label className="analysis-side-radio">
                <input
                  type="radio"
                  name="side-to-move"
                  checked={sideToMove === 'red'}
                  onChange={() => setSideToMove('red')}
                />
                轮到红方走
              </label>
              <label className="analysis-side-radio">
                <input
                  type="radio"
                  name="side-to-move"
                  checked={sideToMove === 'black'}
                  onChange={() => setSideToMove('black')}
                />
                轮到黑方走
              </label>
              <button onClick={handleClearBoard}>清空棋盘</button>
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
