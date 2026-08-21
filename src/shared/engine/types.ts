// 阶段6：和Pikafish引擎打交道用到的类型，main（真正调用引擎）和renderer（展示分析结果）共用。

/** 千分制的胜/和/负概率，直接来自引擎的wdl输出，不需要自己按分数换算 */
export type EngineWdl = [win: number, draw: number, loss: number]

export interface EngineAnalysisResult {
  fen: string
  /** 实际搜索到的深度（正常应该等于请求的深度，除非引擎提前认定绝杀/困毙） */
  depth: number
  /** 统一换算成"厘兵值"分数：普通局面是引擎原始的cp分数；绝杀局面换算成一个很大的正/负数，方便UI不用特判就能按数值排序/画图 */
  scoreCp: number
  isMate: boolean
  /** 剩余多少步绝杀，正数=走棋方杀，负数=走棋方被杀；不是绝杀局面时为null */
  mateIn: number | null
  wdl: EngineWdl
  /** 最佳应对路线，UCCI坐标格式（如"h2e2"），和 MoveNode.moveCoord 同一种记法 */
  pv: string[]
  /** true表示这次没有真正调用引擎，是直接命中缓存返回的 */
  fromCache: boolean
}

export type EngineStatus =
  | { state: 'unavailable'; reason: string }
  | { state: 'starting' }
  | { state: 'ready'; executablePath: string }
  | { state: 'error'; reason: string }
