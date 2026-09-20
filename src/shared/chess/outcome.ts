// 从局面本身判断"这盘棋是不是已经分出胜负了"。
//
// 判据就一条：将（帅）被吃掉了。打谱的时候两边都是用户自己走的，真要分胜负就是一方把
// 对面的将吃掉那一手，所以只要看棋盘上还剩几个将，不需要回放整条棋路。
//
// 注意这里不判"将死"（对方被将军且无棋可走）。打谱到绝杀时很多人就停手不再落子了，
// 那种局面棋盘上两个将都还在，这里一律当成还没结束——要不要把绝杀也算赢是个产品口径问题，
// 当前按"吃了将才算赢"来，和界面上的提示文案保持一致。

import { findGeneral } from './board'
import type { Board, Side } from './types'

/** null = 还没分出胜负（或者是摆局阶段这种两边都没将的局面） */
export type Winner = Side | null

export function winnerFromBoard(board: Board): Winner {
  const redGeneral = findGeneral(board, 'red')
  const blackGeneral = findGeneral(board, 'black')
  // 只有"一方还在、另一方没了"才算分出胜负；两边都没有说明局面还没摆完，不算
  if (redGeneral && !blackGeneral) return 'red'
  if (blackGeneral && !redGeneral) return 'black'
  return null
}
