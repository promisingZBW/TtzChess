// 象棋规则引擎的核心类型定义。main / preload / renderer 三端如果需要用到
// 棋盘、棋子、走法这些概念，都应该从这里导入，不要各自重新定义一遍。

/** 棋子种类：R车 N马 B象/相 A士/仕 K将/帅 C炮 P兵/卒（字母沿用 xiangqi_feature_extraction.py 里已经用过的约定） */
export type PieceKind = 'R' | 'N' | 'B' | 'A' | 'K' | 'C' | 'P'

/** 红方 / 黑方 */
export type Side = 'red' | 'black'

export interface Piece {
  kind: PieceKind
  side: Side
}

/** 一个格子：要么是空的（null），要么是一颗棋子 */
export type Square = Piece | null

/**
 * 棋盘：board[row][col]
 * row 0 = 黑方底线（最上面一行），row 9 = 红方底线（最下面一行）
 * col 0 = 最左边一列，col 8 = 最右边一列
 * 这个坐标约定和 xiangqi_feature_extraction.py 里的注释完全一致，方便后续阶段7移植特征提取代码时对齐。
 */
export type Board = Square[][]

export interface Position {
  row: number
  col: number
}

export interface Move {
  from: Position
  to: Position
}

export function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col
}

export function opponentOf(side: Side): Side {
  return side === 'red' ? 'black' : 'red'
}
