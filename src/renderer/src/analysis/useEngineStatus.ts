// 小工具hook：查询一次Pikafish引擎当前状态，AI分析相关页面用它在顶部提示"引擎还没装好"之类的信息，
// 不因为引擎不可用就阻塞整个页面——用户依然可以摆棋/走棋，只是点"开始分析"时才会真正报错。

import { useEffect, useState } from 'react'
import type { EngineStatus } from '@shared/engine'

export function useEngineStatus(): EngineStatus | null {
  const [status, setStatus] = useState<EngineStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    window.chessoc.engine.getStatus().then((result) => {
      if (!cancelled) setStatus(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return status
}
