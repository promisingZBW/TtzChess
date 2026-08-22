// 整局分析页面（dev guide 7.2节）：选红/黑视角 -> 从标准开局开始，自己一步步把真实棋谱走出来，
// 每走一步同步更新右侧胜率折线图；折线图上的点可以点回去看历史局面；在任意历史点还能
// 额外触发一次完整的"单次分析"（复用7.1的PV步进逻辑和展示格式）。

import { useState } from 'react'
import type { Side } from '@shared/chess'
import { BoardView } from '../board/BoardView'
import { EngineStatusBanner } from './EngineStatusBanner'
import { SingleAnalysisResultsPanel } from './SingleAnalysisResultsPanel'
import { runSinglePositionAnalysis, type SingleAnalysisResult } from './singlePositionAnalysis'
import { useEngineStatus } from './useEngineStatus'
import { useFullGameAnalysis } from './useFullGameAnalysis'
import { WinRateChart } from './WinRateChart'

interface FullGameAnalysisPageProps {
  onBack: () => void
}

interface DeepAnalysisState {
  status: 'idle' | 'loading' | 'done' | 'error'
  result: SingleAnalysisResult | null
  error: string | null
}

const SIDE_LABEL: Record<Side, string> = { red: '红方', black: '黑方' }
const DEEP_ANALYSIS_IDLE: DeepAnalysisState = { status: 'idle', result: null, error: null }

export function FullGameAnalysisPage({ onBack }: FullGameAnalysisPageProps): React.JSX.Element {
  const session = useFullGameAnalysis()
  const engineStatus = useEngineStatus()
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysisState>(DEEP_ANALYSIS_IDLE)

  async function handleDeepAnalyzeViewing(): Promise<void> {
    if (!session.viewingEntry) return
    setDeepAnalysis({ status: 'loading', result: null, error: null })
    try {
      const result = await runSinglePositionAnalysis(
        session.viewingEntry.board,
        session.viewingEntry.sideToMove,
        window.chessoc.engine.analyzePosition
      )
      setDeepAnalysis({ status: 'done', result, error: null })
    } catch (err) {
      setDeepAnalysis({ status: 'error', result: null, error: err instanceof Error ? err.message : String(err) })
    }
  }

  function handleSelectIndex(index: number): void {
    session.jumpToIndex(index)
    setDeepAnalysis(DEEP_ANALYSIS_IDLE)
  }

  if (!session.started) {
    return (
      <div className="study-detail-page">
        <header className="study-toolbar">
          <button className="study-toolbar-back" onClick={onBack}>
            ← 返回
          </button>
          <h2 className="study-title">整局分析</h2>
        </header>
        <div className="analysis-setup">
          <p>选择你要跟踪哪一方的胜率视角，然后从标准开局开始，把这一整局真实棋谱走出来。</p>
          <div className="analysis-controls">
            <label className="analysis-side-radio">
              <input
                type="radio"
                name="perspective"
                checked={session.perspective === 'red'}
                onChange={() => session.setPerspective('red')}
              />
              红方视角
            </label>
            <label className="analysis-side-radio">
              <input
                type="radio"
                name="perspective"
                checked={session.perspective === 'black'}
                onChange={() => session.setPerspective('black')}
              />
              黑方视角
            </label>
            <button className="analysis-start-button" onClick={session.start}>
              开始复盘
            </button>
          </div>
        </div>
      </div>
    )
  }

  const viewingEntry = session.viewingEntry

  if (!viewingEntry) {
    return <div className="study-status-page">正在初始化棋局…</div>
  }

  return (
    <div className="study-detail-page">
      <header className="study-toolbar">
        <button className="study-toolbar-back" onClick={onBack}>
          ← 返回
        </button>
        <h2 className="study-title">整局分析（{SIDE_LABEL[session.perspective]}视角）</h2>
      </header>

      <EngineStatusBanner status={engineStatus} />

      <div className="study-body">
        <div className="study-board-column">
          <div className="study-board-center">
            {!session.isAtLatest && (
              <p className="analysis-hint">正在查看第{session.viewingIndex}步的历史局面，此时无法继续走棋。</p>
            )}
            <BoardView
              board={viewingEntry.board}
              selected={session.selection.selected}
              legalTargets={session.selection.legalTargets}
              onSquareClick={session.handleSquareClick}
            />
            <div className="analysis-controls">
              {!session.isAtLatest && <button onClick={session.backToLatest}>回到最新局面，继续走棋</button>}
              <button onClick={handleDeepAnalyzeViewing} disabled={deepAnalysis.status === 'loading'}>
                {deepAnalysis.status === 'loading' ? '分析中…' : '对当前局面做单次分析'}
              </button>
            </div>
          </div>
        </div>

        <div className="analysis-panel-column">
          <h3>胜率走势</h3>
          <WinRateChart history={session.history} viewingIndex={session.viewingIndex} onSelectIndex={handleSelectIndex} />
          <p className="analysis-hint">
            {viewingEntry?.moveNotation ? `第${session.viewingIndex}步：${viewingEntry.moveNotation}` : '起始局面'}
            {typeof viewingEntry?.winRatePercent === 'number' && ` 胜率：${viewingEntry.winRatePercent}%`}
          </p>

          {deepAnalysis.status !== 'idle' && (
            <div className="analysis-deep-panel">
              <h3>单次分析结果</h3>
              <SingleAnalysisResultsPanel
                status={deepAnalysis.status}
                result={deepAnalysis.result}
                error={deepAnalysis.error}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
