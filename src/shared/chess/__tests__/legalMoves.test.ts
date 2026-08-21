import { describe, expect, it } from 'vitest'
import type { Board, Piece } from '@shared/chess'
import {
  createInitialBoard,
  getLegalMoves,
  isCheckmate,
  isInCheck,
  isStalemate
} from '@shared/chess'

function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null))
}

function place(board: Board, row: number, col: number, piece: Piece): void {
  board[row][col] = piece
}

describe('isInCheck', () => {
  it('对方的车在同一列且中间无遮挡，将/帅处于被将军状态', () => {
    const board = emptyBoard()
    place(board, 9, 4, { kind: 'K', side: 'red' })
    place(board, 0, 4, { kind: 'R', side: 'black' })
    expect(isInCheck(board, 'red')).toBe(true)
  })

  it('中间有己方棋子挡住，就不算被将军', () => {
    const board = emptyBoard()
    place(board, 9, 4, { kind: 'K', side: 'red' })
    place(board, 5, 4, { kind: 'P', side: 'red' })
    place(board, 0, 4, { kind: 'R', side: 'black' })
    expect(isInCheck(board, 'red')).toBe(false)
  })

  it('双方将/帅在同一列且中间清空（照面），也算被将军（飞将）', () => {
    const board = emptyBoard()
    place(board, 9, 4, { kind: 'K', side: 'red' })
    place(board, 0, 4, { kind: 'K', side: 'black' })
    expect(isInCheck(board, 'red')).toBe(true)
    expect(isInCheck(board, 'black')).toBe(true)
  })
})

describe('getLegalMoves：被将军时的走法过滤（含"绝对钉子"场景）', () => {
  it('如果移动某颗子会导致自己被将军（哪怕这颗子本身不是将/帅），这个走法要被排除', () => {
    const board = emptyBoard()
    place(board, 9, 4, { kind: 'K', side: 'red' })
    place(board, 5, 4, { kind: 'R', side: 'red' }) // 这颗车挡在将的正前方
    place(board, 0, 4, { kind: 'R', side: 'black' }) // 对方车在同一列虎视眈眈
    const moves = getLegalMoves(board, 'red')
    // 车如果平移离开第4列，将就直接暴露在对方车的攻击下，这类走法应该被过滤掉
    const illegalSidewaysMove = moves.find(
      (m) => m.from.row === 5 && m.from.col === 4 && m.to.col !== 4
    )
    expect(illegalSidewaysMove).toBeUndefined()
    // 但车沿着第4列上下移动（不解除阻挡）应该还是合法的
    const legalVerticalMove = moves.find(
      (m) => m.from.row === 5 && m.from.col === 4 && m.to.col === 4
    )
    expect(legalVerticalMove).toBeDefined()
  })
})

describe('isCheckmate / isStalemate', () => {
  it('经典"闷宫"类型的将死局面：将被将军且无棋可解', () => {
    const board = emptyBoard()
    // 红帅在中路被黑车沿开放的col4将军；两侧用红车堵死帅的横移空间，
    // 这两个红车自己沿col3/col5或row9移动都碰不到col4，所以也解不了将
    place(board, 9, 4, { kind: 'K', side: 'red' })
    place(board, 9, 3, { kind: 'R', side: 'red' })
    place(board, 9, 5, { kind: 'R', side: 'red' })
    place(board, 0, 4, { kind: 'R', side: 'black' })
    expect(isInCheck(board, 'red')).toBe(true)
    expect(isCheckmate(board, 'red')).toBe(true)
    expect(getLegalMoves(board, 'red')).toHaveLength(0)
  })

  it('困毙（不被将军但无棋可走）：象棋规则里这也算落子方直接判负', () => {
    const board = emptyBoard()
    // 红帅在(9,4)：横移到(9,3)/(9,5)会被黑车吃掉；唯一能走的(8,4)有黑炮占着，
    // 吃掉黑炮后会暴露在黑车(0,4)的攻击线下——但黑炮本身贴身不能被黑炮自己将军
    place(board, 9, 4, { kind: 'K', side: 'red' })
    place(board, 0, 3, { kind: 'R', side: 'black' })
    place(board, 0, 5, { kind: 'R', side: 'black' })
    place(board, 8, 4, { kind: 'C', side: 'black' })
    place(board, 0, 4, { kind: 'R', side: 'black' })
    expect(isInCheck(board, 'red')).toBe(false)
    expect(isStalemate(board, 'red')).toBe(true)
  })
})

describe('createInitialBoard + getLegalMoves：开局局面完整性检查', () => {
  it('开局局面红方走法数量应该是44（象棋引擎测试里公认的perft(1)基准值）', () => {
    const board = createInitialBoard()
    const moves = getLegalMoves(board, 'red')
    expect(moves).toHaveLength(44)
  })

  it('开局局面双方都不处于被将军状态', () => {
    const board = createInitialBoard()
    expect(isInCheck(board, 'red')).toBe(false)
    expect(isInCheck(board, 'black')).toBe(false)
  })
})
