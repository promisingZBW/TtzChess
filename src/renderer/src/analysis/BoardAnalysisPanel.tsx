// 打谱页右侧的"AI分析"面板。内容和阶段8的单次分析页完全一致（胜率 + 后面五步），
// 区别只在于局面不用重新摆——直接吃打谱页当前棋盘，这就是用户要的"一键分析"。
//
// 面板顶部那行是给"棋谱树 / AI分析"两个标签页留的（见 StudyDetailPage），这里只负责
// 标签页里面的内容：引擎状态提示、局面是否已经过期、结果列表。

import type { Side } from '@shared/chess'
import { EngineStatusBanner } from './EngineStatusBanner'
import { SingleAnalysisResultsPanel } from './SingleAnalysisResultsPanel'
import { useEngineStatus } from './useEngineStatus'
import type { PositionAnalysisState } from './usePositionAnalysis'

interface BoardAnalysisPanelProps {
  analysis: PositionAnalysisState
  /** 打谱页当前棋盘对应的FEN；和 analysis.analyzedFen 不一样就说明结论已经过期 */
  currentFen: string
  sideToMove: Side
  /** 分析的是不是沙盘里试走出来的临时局面——是的话要说清楚，别让人以为分析的是正式棋谱 */
  isSandbox: boolean
  onAnalyze: () => void
  onClose: () => void
}

const SIDE_LABEL: Record<Side, string> = { red: '红方', black: '黑方' }

export function BoardAnalysisPanel({
  analysis,
  currentFen,
  sideToMove,
  isSandbox,
  onAnalyze,
  onClose
}: BoardAnalysisPanelProps): React.JSX.Element {
  const engineStatus = useEngineStatus()
  const isStale = analysis.analyzedFen !== null && analysis.analyzedFen !== currentFen
  const busy = analysis.status === 'loading'

  return (
    <div className="board-analysis-panel">
      <div className="board-analysis-header">
        <div className="board-analysis-subject">
          分析对象：当前棋盘（轮到{SIDE_LABEL[sideToMove]}走）
          {isSandbox && <span className="board-analysis-sandbox-tag">沙盘局面</span>}
        </div>
        <div className="board-analysis-header-actions">
          <button onClick={onAnalyze} disabled={busy}>
            {busy ? '分析中…' : isStale ? '分析当前局面' : '重新分析'}
          </button>
          <button className="board-analysis-close" onClick={onClose} title="关掉分析，回到棋谱树">
            ×
          </button>
        </div>
      </div>

      <EngineStatusBanner status={engineStatus} />

      {isStale && !busy && (
        <p className="analysis-hint board-analysis-stale">
          棋盘已经走到别的局面了，下面这份结论对应的是分析时的那一步。
        </p>
      )}

      <div className="board-analysis-body">
        <SingleAnalysisResultsPanel
          status={analysis.status}
          result={analysis.result}
          error={analysis.error}
        />
      </div>
    </div>
  )
}
