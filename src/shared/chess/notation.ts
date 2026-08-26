// 中文纵线记谱法生成，规则详见 xiangqi_app_dev_guide.md 第3.1节，这里是具体实现。
//
// 规则速记：
// - 红方数字用中文数字（一二三四五六七八九），黑方用阿拉伯数字（1-9），
//   这样两方的棋谱混在一起列出来时，一眼就能看出是谁走的
// - 列号：红方从右到左数1-9（col=8是"一"，col=0是"九"）；
//   黑方从左到右数1-9（col=0是"1"，col=8是"9"）
// - "车/炮/兵/将"这类走完还在同一列（纵向移动）的棋子：进/退 + 数字 = 走了几格（距离）
// - 同一列变了（横向平移）：平 + 数字 = 到达的列号
// - "马/象/仕"这类每走一步列必然改变、且不是纯横移的棋子：进/退 + 数字 = 到达的列号
//   （因为它们的移动路径本身不是"沿一条线走几步"，没法用距离表达，只能报目标列）
// - 同一列上有多个同类棋子时，用"前/后"（两个）或"前/中/后"（三个）代替列号前缀

import type { Board, Move, Piece, PieceKind, Position, Side } from './types'

const RED_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

const PIECE_NAME: Record<Side, Record<PieceKind, string>> = {
  red: { R: '车', N: '马', B: '相', A: '仕', K: '帅', C: '炮', P: '兵' },
  black: { R: '车', N: '马', B: '象', A: '士', K: '将', C: '炮', P: '卒' }
}

/** 数字（1-9）按当前方的记谱习惯转成文字：红方中文数字，黑方阿拉伯数字 */
function formatNumber(n: number, side: Side): string {
  if (n < 1 || n > 9) throw new Error(`记谱数字必须在1-9之间，实际收到 ${n}`)
  return side === 'red' ? RED_NUMERALS[n - 1] : String(n)
}

/** 棋盘列号(0-8) 转换成该方视角下的"第几列"（1-9） */
function toFileNumber(col: number, side: Side): number {
  return side === 'red' ? 9 - col : col + 1
}

/** 列号按该方记谱习惯转成文字：红方「五」，黑方「5」。分析里描述威胁位置时用这个，避免写出 e9 这种引擎坐标 */
export function fileLabel(col: number, side: Side): string {
  return formatNumber(toFileNumber(col, side), side)
}

function pieceName(piece: Piece): string {
  return PIECE_NAME[piece.side][piece.kind]
}

/** 棋子在棋谱/棋盘UI上应该显示的中文名，和 pieceName 是同一份映射，供渲染棋盘的组件复用 */
export function getPieceLabel(piece: Piece): string {
  return pieceName(piece)
}

/** 同一列上，和目标棋子同种类、同阵营的所有棋子，按"离对方越近排越前"排序 */
function sameFileSiblingsFrontToBack(board: Board, piece: Piece, col: number): Position[] {
  const siblings: Position[] = []
  for (let row = 0; row < 10; row++) {
    const occupant = board[row][col]
    if (occupant && occupant.kind === piece.kind && occupant.side === piece.side) {
      siblings.push({ row, col })
    }
  }
  // 红方前进方向是row变小，黑方是row变大，所以“最靠前”的定义要按阵营区分
  siblings.sort((a, b) => (piece.side === 'red' ? a.row - b.row : b.row - a.row))
  return siblings
}

/** 前/中/后 这类同列歧义消解前缀；siblings.length <= 1 时不应该调用这个函数 */
function disambiguationPrefix(index: number, total: number): string {
  if (total === 2) return index === 0 ? '前' : '后'
  if (total === 3) return index === 0 ? '前' : index === 1 ? '中' : '后'
  // 极少见的4个以上同列同类子（多见于兵/卒），标准记谱法没有明确定义，
  // 这里退化处理：两端仍用"前/后"，中间按顺序用中文数字标记，避免直接报错。
  if (index === 0) return '前'
  if (index === total - 1) return '后'
  return RED_NUMERALS[index - 1] ?? String(index + 1)
}

/** 走法的"动作"部分：进X / 退X / 平X */
function describeAction(piece: Piece, from: Position, to: Position): string {
  const isForward = piece.side === 'red' ? to.row < from.row : to.row > from.row

  if (from.col === to.col) {
    // 纵向移动：车/炮/兵/将都可能出现，进/退 + 移动距离
    const distance = Math.abs(to.row - from.row)
    return (isForward ? '进' : '退') + formatNumber(distance, piece.side)
  }

  if (from.row === to.row) {
    // 横向平移：只有车/炮/兵(过河后)/将 会出现，平 + 目标列号
    return '平' + formatNumber(toFileNumber(to.col, piece.side), piece.side)
  }

  // 行列都变了：只有马/象/仕会出现，进/退 + 目标列号（而不是距离，因为路径本身不是直线）
  return (isForward ? '进' : '退') + formatNumber(toFileNumber(to.col, piece.side), piece.side)
}

/**
 * 生成一步棋的中文纵线记谱文本。
 * 必须传入"走这步之前"的棋盘状态（用来判断这颗子是谁、以及同列是否有歧义）。
 */
export function moveToChineseNotation(board: Board, move: Move): string {
  const piece = board[move.from.row][move.from.col]
  if (!piece) {
    throw new Error(`记谱失败：起点格 (${move.from.row}, ${move.from.col}) 上没有棋子`)
  }

  const siblings = sameFileSiblingsFrontToBack(board, piece, move.from.col)
  let prefix: string
  if (siblings.length <= 1) {
    prefix = pieceName(piece) + formatNumber(toFileNumber(move.from.col, piece.side), piece.side)
  } else {
    const index = siblings.findIndex((p) => p.row === move.from.row)
    prefix = disambiguationPrefix(index, siblings.length) + pieceName(piece)
  }

  return prefix + describeAction(piece, move.from, move.to)
}
