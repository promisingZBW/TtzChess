import { describe, expect, it } from 'vitest'
import { moveToUcciCoord, positionToUcciSquare } from '../coord'

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
