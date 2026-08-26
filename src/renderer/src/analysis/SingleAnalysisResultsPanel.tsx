import { PIN_DETECTION_DISCLAIMER, WIN_RATE_FORMULA_HINT } from './singlePositionAnalysis'
import type { SingleAnalysisResult } from './singlePositionAnalysis'
import { WinRateValue } from './WinRateValue'
import { explainAnalysisStep } from './explainStep'

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
        当前局面（{PERSPECTIVE_LABEL[result.perspective]}视角）胜率：
        <WinRateValue wdl={result.rootWdl} wdlSide={result.perspective} perspective={result.perspective} />
      </p>
      {result.steps.length === 0 ? (
        <p className="analysis-hint">引擎没有给出有效的应对路线（可能已经是绝杀/困毙局面）。</p>
      ) : (
        <>
          <ol className="analysis-step-list">
            {result.steps.map((step) => {
              const explained = explainAnalysisStep(step, result.perspective)
              const materialChanged = step.materialDiffBefore !== step.materialDiffAfter
              return (
                <li key={step.stepNumber} className="analysis-step">
                  <div className="analysis-step-kicker">
                    第{step.stepNumber}步：<strong>{step.moveNotation}</strong>
                  </div>
                  <div className={`analysis-step-headline win-rate-${explained.winRateTrend}`}>
                    {explained.headline}
                  </div>
                  <div className="analysis-step-detail">
                    胜率
                    <span
                      className={`win-rate-value win-rate-change-${explained.winRateTrend}`}
                      title={WIN_RATE_FORMULA_HINT}
                    >
                      {step.winRateBeforePercent}%→{step.winRateAfterPercent}%
                      <span className="win-rate-tooltip" role="tooltip">
                        {WIN_RATE_FORMULA_HINT}
                      </span>
                    </span>
                    {materialChanged &&
                      `，子力差（红-黑）=${step.materialDiffBefore}→${step.materialDiffAfter}`}
                    ，机动性差（红-黑）={step.mobilityDiffBefore}→{step.mobilityDiffAfter}
                  </div>
                </li>
              )
            })}
          </ol>
          <p className="analysis-pin-disclaimer">{PIN_DETECTION_DISCLAIMER}</p>
        </>
      )}
    </div>
  )
}
