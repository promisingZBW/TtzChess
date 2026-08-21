import { describe, expect, it } from 'vitest'
import type { Board, Piece } from '@shared/chess'
import { createInitialBoard, moveToChineseNotation } from '@shared/chess'

function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null))
}

function place(board: Board, row: number, col: number, piece: Piece): void {
  board[row][col] = piece
}

// 下面这几个开局走法是象棋里人尽皆知的标准写法，用它们当测试用例，
// 相当于拿"公认的正确答案"直接校验记谱算法，而不是自己编几个案例自证自话。
describe('moveToChineseNotation：用公认的经典开局走法验证正确性', () => {
  it('炮二平五（红方右炮从col7平移到中路col4）', () => {
    const board = createInitialBoard()
    const notation = moveToChineseNotation(board, {
      from: { row: 7, col: 7 },
      to: { row: 7, col: 4 }
    })
    expect(notation).toBe('炮二平五')
  })

  it('炮八平五（红方左炮从col1平移到中路col4）', () => {
    const board = createInitialBoard()
    const notation = moveToChineseNotation(board, {
      from: { row: 7, col: 1 },
      to: { row: 7, col: 4 }
    })
    expect(notation).toBe('炮八平五')
  })

  it('马二进三（红方右马从col7跳到col6，进2行）', () => {
    const board = createInitialBoard()
    const notation = moveToChineseNotation(board, {
      from: { row: 9, col: 7 },
      to: { row: 7, col: 6 }
    })
    expect(notation).toBe('马二进三')
  })

  it('马8进7（黑方对称马步，黑方数字用阿拉伯数字）', () => {
    const board = createInitialBoard()
    const notation = moveToChineseNotation(board, {
      from: { row: 0, col: 1 },
      to: { row: 2, col: 2 }
    })
    expect(notation).toBe('马2进3')
  })

  it('相三进五（红方象从col6跳到中路col4）', () => {
    const board = createInitialBoard()
    const notation = moveToChineseNotation(board, {
      from: { row: 9, col: 6 },
      to: { row: 7, col: 4 }
    })
    expect(notation).toBe('相三进五')
  })
})

describe('moveToChineseNotation：同类子歧义消解（前/后/中）', () => {
  it('同一列上有两个红车，前面那个走动应该标"前车"', () => {
    const board = emptyBoard()
    place(board, 5, 4, { kind: 'R', side: 'red' }) // 更靠近黑方，视为"前"
    place(board, 7, 4, { kind: 'R', side: 'red' }) // 更靠近红方，视为"后"
    const notation = moveToChineseNotation(board, {
      from: { row: 5, col: 4 },
      to: { row: 5, col: 6 }
    })
    expect(notation.startsWith('前车')).toBe(true)
  })

  it('同一列上有两个红车，靠后那个走动应该标"后车"', () => {
    const board = emptyBoard()
    place(board, 5, 4, { kind: 'R', side: 'red' })
    place(board, 7, 4, { kind: 'R', side: 'red' })
    const notation = moveToChineseNotation(board, {
      from: { row: 7, col: 4 },
      to: { row: 7, col: 6 }
    })
    expect(notation.startsWith('后车')).toBe(true)
  })

  it('同一列上有三个红兵，中间那个走动应该标"中兵"', () => {
    const board = emptyBoard()
    place(board, 4, 4, { kind: 'P', side: 'red' }) // 前
    place(board, 5, 4, { kind: 'P', side: 'red' }) // 中
    place(board, 6, 4, { kind: 'P', side: 'red' }) // 后（还没过河）
    const notation = moveToChineseNotation(board, {
      from: { row: 5, col: 4 },
      to: { row: 4, col: 4 }
    })
    expect(notation.startsWith('中兵')).toBe(true)
  })

  it('没有歧义时，正常用列号，不加前/后/中前缀', () => {
    const board = emptyBoard()
    place(board, 6, 4, { kind: 'P', side: 'red' })
    const notation = moveToChineseNotation(board, {
      from: { row: 6, col: 4 },
      to: { row: 5, col: 4 }
    })
    expect(notation).toBe('兵五进一')
  })
})
