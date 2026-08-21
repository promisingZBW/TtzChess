import { describe, expect, it } from 'vitest'
import { createEmptyBoard, setSquare } from '../board'

describe('createEmptyBoard / setSquare（摆局阶段用的棋盘编辑工具）', () => {
  it('createEmptyBoard 返回10x9的全空棋盘', () => {
    const board = createEmptyBoard()
    expect(board).toHaveLength(10)
    for (const row of board) {
      expect(row).toHaveLength(9)
      expect(row.every((square) => square === null)).toBe(true)
    }
  })

  it('setSquare 能在空棋盘上摆放一颗棋子，且不影响原棋盘（不可变更新）', () => {
    const empty = createEmptyBoard()
    const placed = setSquare(empty, { row: 0, col: 4 }, { kind: 'K', side: 'black' })

    expect(placed[0][4]).toEqual({ kind: 'K', side: 'black' })
    expect(empty[0][4]).toBeNull() // 原棋盘不受影响
  })

  it('setSquare 传null能清空一个已经有子的格子', () => {
    const empty = createEmptyBoard()
    const placed = setSquare(empty, { row: 0, col: 4 }, { kind: 'K', side: 'black' })
    const removed = setSquare(placed, { row: 0, col: 4 }, null)

    expect(removed[0][4]).toBeNull()
  })
})
