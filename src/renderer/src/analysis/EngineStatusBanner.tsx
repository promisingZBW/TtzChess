// 引擎状态提示条：只在"引擎明显用不了"的时候显示一句提示，其余状态不打扰用户
// （'ready'不用提示；'unavailable'/'starting'/'error'各自给一句人话说明，不阻塞页面其它交互）。

import type { EngineStatus } from '@shared/engine'

export function EngineStatusBanner({ status }: { status: EngineStatus | null }): React.JSX.Element | null {
  if (!status || status.state === 'ready') return null

  if (status.state === 'starting') {
    return <p className="analysis-engine-banner">引擎正在启动…</p>
  }

  if (status.state === 'unavailable') {
    return (
      <p className="analysis-engine-banner analysis-engine-banner-warn">
        引擎尚未就绪：{status.reason}。点击"开始分析"时会自动尝试启动。
      </p>
    )
  }

  return <p className="analysis-engine-banner analysis-engine-banner-warn">引擎出现问题：{status.reason}</p>
}
