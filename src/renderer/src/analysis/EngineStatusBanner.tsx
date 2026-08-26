// 引擎状态提示条：只在引擎明显用不了的时候显示。已经装好、只是还没拉起子进程（idle）
// 以及已经就绪（ready）都不打扰用户。

import type { EngineStatus } from '@shared/engine'

export function EngineStatusBanner({ status }: { status: EngineStatus | null }): React.JSX.Element | null {
  if (!status || status.state === 'ready' || status.state === 'idle') return null

  if (status.state === 'starting') {
    return <p className="analysis-engine-banner">引擎正在启动…</p>
  }

  if (status.state === 'unavailable') {
    return <p className="analysis-engine-banner analysis-engine-banner-warn">{status.reason}</p>
  }

  return <p className="analysis-engine-banner analysis-engine-banner-warn">引擎出现问题：{status.reason}</p>
}
