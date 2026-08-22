// 单次分析结果的展示栏（dev guide 7.1节规定的格式），单次分析页面和整局分析页面里
// "对某一步触发单次分析"都复用这一个组件，保证两处的展示格式完全一致。

import type { SingleAnalysisResult } from './singlePositionAnalysis'
import { describeThreat } from './singlePositionAnalysis'

interface SingleAnalysisResultsPanelProps {
  status: 'idle' | 'loading' | 'done' | 'error'
  result: SingleAnalysisResult | null
  error: string | null
}

const PERSPECTIVE_LABEL: Record<'red' | 'black', string> = { red: '红方', black: '黑方' }

export function SingleAnalysisResultsPanel({
  status,
  result,
  error
}: SingleAnalysisResultsPanelProps): React.JSX.Element {
  if (status === 'idle') {
    return <p className="analysis-hint">摆好想分析的局面后，点击"开始分析"。</p>
  }

  if (status === 'loading') {
    return (
      <div className="analysis-loading">
        <div className="analysis-spinner" aria-hidden="true" />
        <p>正在分析中，需要依次查询PV路线上每一步的局面，请稍候…</p>
      </div>
    )
  }

  if (status === 'error') {
    return <p className="analysis-hint analysis-hint-error">分析失败：{error}</p>
  }

  if (!result) return <p className="analysis-hint">没有分析结果。</p>

  return (
    <div className="analysis-results">
      <p className="analysis-root-summary">
        当前局面（{PERSPECTIVE_LABEL[result.perspective]}视角）胜率：<strong>{result.rootWinRatePercent}%</strong>
        （胜{result.rootWdl[0]} 和{result.rootWdl[1]} 负{result.rootWdl[2]}，千分制）
      </p>
      {result.steps.length === 0 ? (
        <p className="analysis-hint">引擎没有给出有效的应对路线（可能已经是绝杀/困毙局面）。</p>
      ) : (
        <ol className="analysis-step-list">
          {result.steps.map((step) => (
            <li key={step.stepNumber} className="analysis-step">
              <div className="analysis-step-headline">
                第{step.stepNumber}步：走法=<strong>{step.moveNotation}</strong>，引擎胜率={step.winRateBeforePercent}%→
                {step.winRateAfterPercent}%
              </div>
              <div className="analysis-step-detail">
                子力差（红-黑）={step.materialDiffBefore}→{step.materialDiffAfter}，机动性差（红-黑）=
                {step.mobilityDiffBefore}→{step.mobilityDiffAfter}
              </div>
              <div className="analysis-step-detail">
                威胁=
                {step.threats.length === 0
                  ? '无'
                  : step.threats.map(describeThreat).join('、')}
                {step.isDiscoveredThreat && <span className="analysis-tag-discovered"> 疑似抽将模式</span>}
              </div>
              <div className="analysis-step-note">备注：{step.note}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
