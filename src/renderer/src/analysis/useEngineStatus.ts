// 小工具hook：查询Pikafish引擎当前状态。分析页顶部用它提示"没装引擎/启动失败"，
// 不因为引擎暂时还没拉起就挡住走棋。状态会定时刷新，分析成功后横幅会自己消失。

import { useEffect, useState } from 'react'
import type { EngineStatus } from '@shared/engine'

const POLL_MS = 2000

export function useEngineStatus(): EngineStatus | null {
  const [status, setStatus] = useState<EngineStatus | null>(null)

  useEffect(() => {
    let cancelled = false

    async function refresh(): Promise<void> {
      try {
        const result = await window.chessoc.engine.getStatus()
        if (!cancelled) setStatus(result)
      } catch {
        if (!cancelled) setStatus({ state: 'error', reason: '无法读取引擎状态' })
      }
    }

    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return status
}
