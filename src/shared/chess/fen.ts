// 象棋 FEN 变种的解析与序列化。
// 采用 UCCI 协议 / Pikafish 引擎通用的棋盘记法：
//   <棋盘> <轮到谁走：w=红 b=黑> - - <半回合计数> <回合数>
// 棋盘部分从第10行（黑方底线，最上面）到第1行（红方底线，最下面），每行9列，'/'分隔，
// 数字表示连续空格数，字母见 PieceKind：R车 N马 B象/相 A士/仕 K将/帅 C炮 P兵/卒，
// 大写=红方，小写=黑方。

import type { Board, PieceKind, Side, Square } from './types'

export const STANDARD_START_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'

/** 完全空白的棋盘（10行，每行9个空格），中局/终局案例"摆局阶段"的起始局面用这个 */
export const EMPTY_BOARD_FEN = '9/9/9/9/9/9/9/9/9/9 w - - 0 1'

const LETTER_TO_KIND: Record<string, PieceKind> = {
  r: 'R',
  n: 'N',
  b: 'B',
  a: 'A',
  k: 'K',
  c: 'C',
  p: 'P'
}

const KIND_TO_LETTER: Record<PieceKind, string> = {
  R: 'r',
  N: 'n',
  B: 'b',
  A: 'a',
  K: 'k',
  C: 'c',
  P: 'p'
}

export interface ParsedFen {
  board: Board
  sideToMove: Side
}

export function parseFen(fen: string): ParsedFen {
  const parts = fen.trim().split(/\s+/)
  const boardPart = parts[0]
  const sidePart = parts[1] ?? 'w'

  const rowStrings = boardPart.split('/')
  if (rowStrings.length !== 10) {
    throw new Error(`非法FEN：棋盘部分应有10行，实际解析出${rowStrings.length}行 -> "${fen}"`)
  }

  const board: Board = rowStrings.map((rowStr, rowIndex) => {
    const row: Square[] = []
    for (const ch of rowStr) {
      if (ch >= '0' && ch <= '9') {
        const emptyCount = Number(ch)
        for (let i = 0; i < emptyCount; i++) row.push(null)
      } else {
        const kind = LETTER_TO_KIND[ch.toLowerCase()]
        if (!kind) {
          throw new Error(`非法FEN：第${rowIndex + 1}行出现无法识别的字符 "${ch}" -> "${fen}"`)
        }
        row.push({ kind, side: ch === ch.toUpperCase() ? 'red' : 'black' })
      }
    }
    if (row.length !== 9) {
      throw new Error(`非法FEN：第${rowIndex + 1}行应有9列，实际解析出${row.length}列 -> "${fen}"`)
    }
    return row
  })

  const sideToMove: Side = sidePart === 'b' ? 'black' : 'red'

  return { board, sideToMove }
}

export function boardToFen(
  board: Board,
  sideToMove: Side,
  halfmoveClock = 0,
  fullmoveNumber = 1
): string {
  const rowStrings = board.map((row) => {
    let rowStr = ''
    let emptyRun = 0
    for (const square of row) {
      if (!square) {
        emptyRun += 1
        continue
      }
      if (emptyRun > 0) {
        rowStr += String(emptyRun)
        emptyRun = 0
      }
      const letter = KIND_TO_LETTER[square.kind]
      rowStr += square.side === 'red' ? letter.toUpperCase() : letter
    }
    if (emptyRun > 0) rowStr += String(emptyRun)
    return rowStr
  })

  const boardPart = rowStrings.join('/')
  const sidePart = sideToMove === 'red' ? 'w' : 'b'
  return `${boardPart} ${sidePart} - - ${halfmoveClock} ${fullmoveNumber}`
}
