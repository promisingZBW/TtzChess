// AI分析入口页（dev guide 第7节）：首页第4个功能入口点进来先看到这个，
// 两个子功能选项——单次分析（摆一个局面分析一下）、整局分析（走一整局，看胜率走势）。

interface AnalysisHomePageProps {
  onBack?: () => void
  onOpenSingleAnalysis: () => void
  onOpenFullGameAnalysis: () => void
}

export function AnalysisHomePage({
  onBack,
  onOpenSingleAnalysis,
  onOpenFullGameAnalysis
}: AnalysisHomePageProps): React.JSX.Element {
  return (
    <div className={onBack ? 'home-page' : 'home-embedded-panel'}>
      {onBack && (
        <header className="study-toolbar">
          <button className="study-toolbar-back" onClick={onBack}>
            ← 返回首页
          </button>
          <h2 className="study-title">AI 分析</h2>
        </header>
      )}

      <section className="home-section analysis-entry-section">
        <button className="analysis-entry-card" onClick={onOpenSingleAnalysis}>
          <h3>单次分析</h3>
          <p>摆出一个想研究的局面，让引擎给出最佳应对路线，逐步展示胜率变化、子力/机动性差异和威胁提示。</p>
        </button>
        <button className="analysis-entry-card" onClick={onOpenFullGameAnalysis}>
          <h3>整局分析</h3>
          <p>选一个视角，把一整局真实棋谱走出来，实时看胜率走势折线图，随时回看历史局面并深入分析。</p>
        </button>
      </section>
    </div>
  )
}
