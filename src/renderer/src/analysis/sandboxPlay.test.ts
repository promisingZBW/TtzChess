import { describe, expect, it } from 'vitest'
import { parseFen, STANDARD_START_FEN } from '@shared/chess'
import { clickSandboxSquare, EMPTY_SANDBOX_SELECTION } from './sandboxPlay'

describe('clickSandboxSquare', () => {
  it('点己方棋子后，再点合法目标格会走子并换边，不依赖棋谱树', () => {
    const { board, sideToMove } = parseFen(STANDARD_START_FEN)
    const selected = clickSandboxSquare(
      { board, sideToMove, selection: EMPTY_SANDBOX_SELECTION },
      { row: 9, col: 1 }
    )
    expect(selected.selection.selected).toEqual({ row: 9, col: 1 })
    expect(selected.selection.legalTargets.length).toBeGreaterThan(0)

    const after = clickSandboxSquare(selected, selected.selection.legalTargets[0])
    expect(after.sideToMove).toBe('black')
    expect(after.board[9][1]).toBeNull()
    expect(after.selection).toEqual(EMPTY_SANDBOX_SELECTION)
  })
})
