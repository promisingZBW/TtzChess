// UCI协议文本行的解析，纯函数、不涉及任何进程/IO，方便单独写单元测试。
// 参考格式（来自Pikafish官方wiki "UCI & Commands"文档）：
//   info depth 5 seldepth 2 multipv 1 score cp 320 wdl 726 274 0 nodes 389 nps 129666 ... pv b2e2
//   info depth 5 seldepth 2 multipv 1 score mate 1 nodes 34 nps 11333 ... pv e7d7
//   bestmove b2e2 ponder h9g7
//
// 引擎每次 "go depth N" 搜索过程中会连续打印多条从浅到深的info行（越往后越准），
// 只有最后一条 bestmove 出现时才代表这次搜索真正结束，前面的info行只是过程展示。

export interface UciInfoUpdate {
  depth: number
  /** 普通局面是引擎原始cp分数；info行是"score mate N"时，这里换算成一个足够大的正/负数，方便统一处理 */
  scoreCp: number
  isMate: boolean
  mateIn: number | null
  /** 引擎没开UCI_ShowWDL、或者这一条info行本身没带wdl字段时为null */
  wdl: [number, number, number] | null
  /** UCCI坐标格式的最佳应对路线，如 ["h2e2", "h9g7"] */
  pv: string[]
}

/** 绝杀分数换算成一个明显超出正常局面cp范围（一般不到2000）的数值，让"净胜"排在所有正常分数前面 */
const MATE_SCORE_BASE = 30000

/**
 * 解析一行 "info ... pv ..." 输出。
 * 只关心带 pv 字段的info行（代表这是一次完整的搜索结果更新），
 * 像 "info string NNUE evaluation using pikafish.nnue enabled" 这种不带pv的提示行会被忽略、返回null。
 */
export function parseUciInfoLine(line: string): UciInfoUpdate | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('info ')) return null

  const tokens = trimmed.split(/\s+/)
  const pvIndex = tokens.indexOf('pv')
  if (pvIndex === -1 || pvIndex === tokens.length - 1) return null

  const depthIndex = tokens.indexOf('depth')
  const depth = depthIndex !== -1 ? Number(tokens[depthIndex + 1]) : 0

  let scoreCp = 0
  let isMate = false
  let mateIn: number | null = null
  const scoreIndex = tokens.indexOf('score')
  if (scoreIndex !== -1) {
    const scoreType = tokens[scoreIndex + 1]
    const scoreValue = Number(tokens[scoreIndex + 2])
    if (scoreType === 'mate') {
      isMate = true
      mateIn = scoreValue
      scoreCp = scoreValue >= 0 ? MATE_SCORE_BASE - scoreValue : -MATE_SCORE_BASE - scoreValue
    } else if (Number.isFinite(scoreValue)) {
      scoreCp = scoreValue
    }
  }

  const wdlIndex = tokens.indexOf('wdl')
  const wdl: [number, number, number] | null =
    wdlIndex !== -1
      ? [Number(tokens[wdlIndex + 1]), Number(tokens[wdlIndex + 2]), Number(tokens[wdlIndex + 3])]
      : null

  const pv = tokens.slice(pvIndex + 1)

  return { depth, scoreCp, isMate, mateIn, wdl, pv }
}

export interface UciBestMove {
  /** 无棋可走（绝杀/困毙）时引擎会输出"bestmove (none)"，这里统一转成null */
  bestMove: string | null
  ponder: string | null
}

export function parseBestMoveLine(line: string): UciBestMove | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('bestmove')) return null

  const tokens = trimmed.split(/\s+/)
  const rawBestMove = tokens[1] ?? null
  const ponderIndex = tokens.indexOf('ponder')
  const ponder = ponderIndex !== -1 ? tokens[ponderIndex + 1] ?? null : null

  return { bestMove: rawBestMove === '(none)' ? null : rawBestMove, ponder }
}
