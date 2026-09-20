import { describe, expect, it } from 'vitest'
import { createEmptyBoard, parseFen, setSquare, STANDARD_START_FEN, winnerFromBoard } from '../index'

describe('winnerFromBoard', () => {
  it('开局局面两个将都在，没分胜负', () => {
    expect(winnerFromBoard(parseFen(STANDARD_START_FEN).board)).toBeNull()
  })

  it('黑将被吃掉了算红方胜', () => {
    const board = parseFen('4a4/9/9/9/9/9/9/9/9/4K4 w - - 0 1').board
    expect(winnerFromBoard(board)).toBe('red')
  })

  it('红帅被吃掉了算黑方胜', () => {
    const board = parseFen('4k4/9/9/9/9/9/9/9/9/4A4 w - - 0 1').board
    expect(winnerFromBoard(board)).toBe('black')
  })

  it('空棋盘不算分出胜负——摆局阶段两边都还没放将', () => {
    expect(winnerFromBoard(createEmptyBoard())).toBeNull()
  })

  it('只有一方有将，就算那一方赢——摆局阶段得由调用方自己避开', () => {
    // 摆残局时会先放下红帅、还没放黑将，这一瞬间这个函数就会返回 'red'。
    // 函数本身只看棋盘、不知道用户在干嘛，所以界面那边用 mode === 'recording' 把摆局阶段挡掉。
    const board = setSquare(createEmptyBoard(), { row: 9, col: 4 }, { kind: 'K', side: 'red' })
    expect(winnerFromBoard(board)).toBe('red')
  })
})
