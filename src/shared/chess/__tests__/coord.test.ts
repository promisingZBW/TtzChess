import { describe, expect, it } from 'vitest'
import { moveToUcciCoord, positionToUcciSquare, ucciCoordToMove, ucciSquareToPosition } from '../coord'

describe('UCCI坐标记法', () => {
  it('positionToUcciSquare：红方底线(row9)对应rank0，黑方底线(row0)对应rank9', () => {
    expect(positionToUcciSquare({ row: 9, col: 0 })).toBe('a0')
    expect(positionToUcciSquare({ row: 0, col: 8 })).toBe('i9')
  })

  it('moveToUcciCoord：红方开局"炮二平五"应该是h2e2（和dev guide示例一致）', () => {
    // 红方右炮起始位置在 row7,col7；平五移动到 row7,col4（同一行，中间那一列）
    const coord = moveToUcciCoord({ from: { row: 7, col: 7 }, to: { row: 7, col: 4 } })
    expect(coord).toBe('h2e2')
  })
})

describe('UCCI坐标反解析（阶段8：沿引擎PV模拟局面要用到）', () => {
  it('ucciSquareToPosition是positionToUcciSquare的反函数', () => {
    expect(ucciSquareToPosition('a0')).toEqual({ row: 9, col: 0 })
    expect(ucciSquareToPosition('i9')).toEqual({ row: 0, col: 8 })
  })

  it('ucciCoordToMove："h2e2"应该还原成炮二平五那一步的坐标', () => {
    expect(ucciCoordToMove('h2e2')).toEqual({ from: { row: 7, col: 7 }, to: { row: 7, col: 4 } })
  })

  it('对任意走法，先转成UCCI坐标再转回来应该得到原始走法（round-trip）', () => {
    const move = { from: { row: 6, col: 2 }, to: { row: 5, col: 2 } }
    expect(ucciCoordToMove(moveToUcciCoord(move))).toEqual(move)
  })
})
