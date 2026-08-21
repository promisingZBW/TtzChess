import { describe, expect, it } from 'vitest'
import { STANDARD_START_FEN, boardToFen, parseFen } from '@shared/chess'

describe('parseFen', () => {
  it('能正确解析标准开局FEN的棋盘尺寸和几个关键位置', () => {
    const { board, sideToMove } = parseFen(STANDARD_START_FEN)
    expect(board).toHaveLength(10)
    expect(board.every((row) => row.length === 9)).toBe(true)
    expect(sideToMove).toBe('red')

    // row9(红方底线) 第一个字符 'R' -> 红车
    expect(board[9][0]).toEqual({ kind: 'R', side: 'red' })
    // row0(黑方底线) 最后一个字符 'r' -> 黑车
    expect(board[0][8]).toEqual({ kind: 'R', side: 'black' })
    // row9 中间 'K' -> 红帅
    expect(board[9][4]).toEqual({ kind: 'K', side: 'red' })
    // row6 兵的位置 'P1P1P1P1P'，col0应该是兵，col1应该是空
    expect(board[6][0]).toEqual({ kind: 'P', side: 'red' })
    expect(board[6][1]).toBeNull()
  })

  it('轮到黑方走的FEN能正确解析sideToMove', () => {
    const { sideToMove } = parseFen(STANDARD_START_FEN.replace(' w ', ' b '))
    expect(sideToMove).toBe('black')
  })

  it('行数不对时应该抛出明确的错误', () => {
    expect(() => parseFen('9/9/9 w - - 0 1')).toThrow(/10行/)
  })

  it('出现无法识别的字符时应该抛出明确的错误', () => {
    const badFen = STANDARD_START_FEN.replace('R', 'X')
    expect(() => parseFen(badFen)).toThrow(/无法识别/)
  })
})

describe('boardToFen', () => {
  it('标准开局棋盘序列化后，棋盘部分应该和原始FEN一致（round-trip）', () => {
    const { board } = parseFen(STANDARD_START_FEN)
    const regenerated = boardToFen(board, 'red')
    const [originalBoardPart] = STANDARD_START_FEN.split(' ')
    const [regeneratedBoardPart] = regenerated.split(' ')
    expect(regeneratedBoardPart).toBe(originalBoardPart)
  })

  it('sideToMove为黑方时，序列化结果里应该是 b', () => {
    const { board } = parseFen(STANDARD_START_FEN)
    const fen = boardToFen(board, 'black')
    expect(fen.split(' ')[1]).toBe('b')
  })
})
