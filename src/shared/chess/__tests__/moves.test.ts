import { describe, expect, it } from 'vitest'
import type { Board, Piece } from '@shared/chess'
import {
  generateAdvisorMoves,
  generateCannonMoves,
  generateElephantMoves,
  generateGeneralMoves,
  generateHorseMoves,
  generateRookMoves,
  generateSoldierMoves
} from '@shared/chess'

function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null))
}

function place(board: Board, row: number, col: number, piece: Piece): void {
  board[row][col] = piece
}

function sortPositions(positions: { row: number; col: number }[]): string[] {
  return positions.map((p) => `${p.row},${p.col}`).sort()
}

describe('generateRookMoves', () => {
  it('在空棋盘上四个方向都能一路滑到底', () => {
    const board = emptyBoard()
    place(board, 5, 4, { kind: 'R', side: 'red' })
    const moves = generateRookMoves(board, { row: 5, col: 4 }, 'red')
    // 棋盘10行9列，row5往上到row0共5格，往下到row9共4格，左右各4格：5+4+4+4=17
    expect(moves).toHaveLength(17)
  })

  it('遇到己方棋子会停在它前面一格，不能吃自己人', () => {
    const board = emptyBoard()
    place(board, 5, 4, { kind: 'R', side: 'red' })
    place(board, 5, 6, { kind: 'P', side: 'red' }) // 右边2格处放一个自己的兵
    const moves = generateRookMoves(board, { row: 5, col: 4 }, 'red')
    expect(sortPositions(moves)).toContain('5,5')
    expect(sortPositions(moves)).not.toContain('5,6')
    expect(sortPositions(moves)).not.toContain('5,7')
  })

  it('遇到敌方棋子可以吃掉，但不能吃穿过去', () => {
    const board = emptyBoard()
    place(board, 5, 4, { kind: 'R', side: 'red' })
    place(board, 5, 6, { kind: 'P', side: 'black' })
    const moves = generateRookMoves(board, { row: 5, col: 4 }, 'red')
    expect(sortPositions(moves)).toContain('5,6') // 可以吃
    expect(sortPositions(moves)).not.toContain('5,7') // 吃完就停，不能继续往后
  })
})

describe('generateCannonMoves', () => {
  it('不隔子的情况下，只能滑到空格，不能吃子', () => {
    const board = emptyBoard()
    place(board, 5, 4, { kind: 'C', side: 'red' })
    place(board, 5, 6, { kind: 'P', side: 'black' }) // 相邻方向上直接遇到敌子，没有炮架
    const moves = generateCannonMoves(board, { row: 5, col: 4 }, 'red')
    expect(sortPositions(moves)).toContain('5,5') // 5,5是空格，可以走
    expect(sortPositions(moves)).not.toContain('5,6') // 没有炮架，不能直接吃
  })

  it('隔着一个炮架，可以吃架子后面的敌方棋子', () => {
    const board = emptyBoard()
    place(board, 5, 4, { kind: 'C', side: 'red' })
    place(board, 5, 5, { kind: 'P', side: 'red' }) // 炮架（己方棋子也可以当炮架）
    place(board, 5, 7, { kind: 'P', side: 'black' })
    const moves = generateCannonMoves(board, { row: 5, col: 4 }, 'red')
    expect(sortPositions(moves)).toContain('5,7')
    expect(sortPositions(moves)).not.toContain('5,6') // 炮架和目标之间的格子不能落子
  })

  it('隔着炮架，但架子后面是己方棋子，不能吃', () => {
    const board = emptyBoard()
    place(board, 5, 4, { kind: 'C', side: 'red' })
    place(board, 5, 5, { kind: 'P', side: 'black' })
    place(board, 5, 7, { kind: 'P', side: 'red' })
    const moves = generateCannonMoves(board, { row: 5, col: 4 }, 'red')
    expect(sortPositions(moves)).not.toContain('5,7')
  })
})

describe('generateHorseMoves', () => {
  it('在空棋盘中间，8个方向都能走', () => {
    const board = emptyBoard()
    place(board, 5, 4, { kind: 'N', side: 'red' })
    const moves = generateHorseMoves(board, { row: 5, col: 4 }, 'red')
    expect(moves).toHaveLength(8)
  })

  it('蹩马腿：某个方向的"腿"被占住，那个方向就不能走', () => {
    const board = emptyBoard()
    place(board, 5, 4, { kind: 'N', side: 'red' })
    place(board, 4, 4, { kind: 'P', side: 'red' }) // 挡住向上(row-1)的两条腿
    const moves = generateHorseMoves(board, { row: 5, col: 4 }, 'red')
    expect(sortPositions(moves)).not.toContain('3,3')
    expect(sortPositions(moves)).not.toContain('3,5')
    // 其余6个方向不受影响
    expect(moves).toHaveLength(6)
  })
})

describe('generateElephantMoves', () => {
  it('塞象眼：眼位被占住，该方向不能走', () => {
    const board = emptyBoard()
    place(board, 9, 2, { kind: 'B', side: 'red' })
    place(board, 8, 3, { kind: 'P', side: 'red' }) // 塞住去(7,4)方向的象眼
    const moves = generateElephantMoves(board, { row: 9, col: 2 }, 'red')
    expect(sortPositions(moves)).not.toContain('7,4')
  })

  it('不能过河', () => {
    const board = emptyBoard()
    place(board, 5, 2, { kind: 'B', side: 'red' }) // 红方象已经在河边
    const moves = generateElephantMoves(board, { row: 5, col: 2 }, 'red')
    // 目标行3（过河后）不应该出现，只能留在4以后的行（红方半场）
    expect(moves.every((m) => m.row >= 5)).toBe(true)
  })
})

describe('generateAdvisorMoves', () => {
  it('仕/士只能在九宫内斜走', () => {
    const board = emptyBoard()
    place(board, 9, 3, { kind: 'A', side: 'red' })
    const moves = generateAdvisorMoves(board, { row: 9, col: 3 }, 'red')
    expect(sortPositions(moves)).toEqual(['8,4'])
  })
})

describe('generateSoldierMoves', () => {
  it('过河前只能直走，不能左右走', () => {
    const board = emptyBoard()
    place(board, 6, 4, { kind: 'P', side: 'red' }) // 还没过河
    const moves = generateSoldierMoves(board, { row: 6, col: 4 }, 'red')
    expect(sortPositions(moves)).toEqual(['5,4'])
  })

  it('过河后可以直走或左右走，但不能后退', () => {
    const board = emptyBoard()
    place(board, 4, 4, { kind: 'P', side: 'red' }) // 已过河
    const moves = generateSoldierMoves(board, { row: 4, col: 4 }, 'red')
    expect(sortPositions(moves)).toEqual(['3,4', '4,3', '4,5'])
  })
})

describe('generateGeneralMoves', () => {
  it('将/帅只能在九宫内走一步', () => {
    const board = emptyBoard()
    place(board, 9, 4, { kind: 'K', side: 'red' })
    const moves = generateGeneralMoves(board, { row: 9, col: 4 }, 'red')
    expect(sortPositions(moves)).toEqual(['8,4', '9,3', '9,5'])
  })

  it('飞将：同一列一路清空，能"看到"对方的将/帅，会被列为可攻击目标', () => {
    const board = emptyBoard()
    place(board, 9, 4, { kind: 'K', side: 'red' })
    place(board, 0, 4, { kind: 'K', side: 'black' })
    const moves = generateGeneralMoves(board, { row: 9, col: 4 }, 'red')
    expect(sortPositions(moves)).toContain('0,4')
  })

  it('中间隔着棋子就不算飞将', () => {
    const board = emptyBoard()
    place(board, 9, 4, { kind: 'K', side: 'red' })
    place(board, 5, 4, { kind: 'P', side: 'red' })
    place(board, 0, 4, { kind: 'K', side: 'black' })
    const moves = generateGeneralMoves(board, { row: 9, col: 4 }, 'red')
    expect(sortPositions(moves)).not.toContain('0,4')
  })
})
