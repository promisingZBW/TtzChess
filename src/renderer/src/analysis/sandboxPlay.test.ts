import { describe, expect, it } from 'vitest'
import { parseFen, STANDARD_START_FEN } from '@shared/chess'
import {
  canSandboxGoBack,
  canSandboxGoForward,
  clickSandboxSquare,
  createSandbox,
  EMPTY_SANDBOX_SELECTION,
  sandboxFrame,
  sandboxGoBack,
  sandboxGoForward
} from './sandboxPlay'

function standardSandbox() {
  const { board, sideToMove } = parseFen(STANDARD_START_FEN)
  return createSandbox(board, sideToMove)
}

/** 从当前局面选中某个子、再走到它第一个合法目标；返回走完之后的沙盘 */
function playFirstLegalMove(state: ReturnType<typeof standardSandbox>, from: { row: number; col: number }) {
  const selected = clickSandboxSquare(state, from).state
  return clickSandboxSquare(selected, selected.selection.legalTargets[0])
}

describe('clickSandboxSquare', () => {
  it('点己方棋子后，再点合法目标格会走子并换边，不依赖棋谱树', () => {
    const start = standardSandbox()
    const selected = clickSandboxSquare(start, { row: 9, col: 1 }).state
    expect(selected.selection.selected).toEqual({ row: 9, col: 1 })
    expect(selected.selection.legalTargets.length).toBeGreaterThan(0)

    const after = clickSandboxSquare(selected, selected.selection.legalTargets[0])
    const frame = sandboxFrame(after.state)
    expect(frame.sideToMove).toBe('black')
    expect(frame.board[9][1]).toBeNull()
    expect(after.state.selection).toEqual(EMPTY_SANDBOX_SELECTION)
    expect(after.moved).toEqual({ captured: false })
  })

  it('没走成子时 moved 是 null（放音效的地方靠它判断该不该响）', () => {
    const start = standardSandbox()
    expect(clickSandboxSquare(start, { row: 9, col: 1 }).moved).toBeNull() // 只是选中
    expect(clickSandboxSquare(start, { row: 0, col: 0 }).moved).toBeNull() // 点的是对方的子
  })
})

describe('沙盘里的前进后退', () => {
  it('刚进沙盘时两边都退不动也进不动', () => {
    const start = standardSandbox()
    expect(canSandboxGoBack(start)).toBe(false)
    expect(canSandboxGoForward(start)).toBe(false)
  })

  it('走两步之后可以一路退回起点，再前进回去', () => {
    const start = standardSandbox()
    const startFrame = sandboxFrame(start)

    const afterFirst = playFirstLegalMove(start, { row: 9, col: 1 }).state
    const afterSecond = playFirstLegalMove(afterFirst, { row: 0, col: 1 }).state
    expect(afterSecond.history).toHaveLength(3)
    expect(canSandboxGoBack(afterSecond)).toBe(true)
    expect(canSandboxGoForward(afterSecond)).toBe(false)

    const backToStart = sandboxGoBack(sandboxGoBack(afterSecond))
    expect(backToStart.cursor).toBe(0)
    expect(sandboxFrame(backToStart).board).toEqual(startFrame.board)
    expect(canSandboxGoBack(backToStart)).toBe(false)

    const forwardAgain = sandboxGoForward(sandboxGoForward(backToStart))
    expect(forwardAgain.cursor).toBe(2)
    expect(sandboxFrame(forwardAgain).board).toEqual(sandboxFrame(afterSecond).board)
  })

  it('退回去之后再走一步新的，原来那条"未来"会被丢掉', () => {
    const start = standardSandbox()
    const afterTwo = playFirstLegalMove(playFirstLegalMove(start, { row: 9, col: 1 }).state, {
      row: 0,
      col: 1
    }).state
    expect(afterTwo.history).toHaveLength(3)

    // 退回第一步之后，轮到黑方走，换一个子重走
    const rewound = sandboxGoBack(afterTwo)
    expect(sandboxFrame(rewound).sideToMove).toBe('black')
    const rewritten = playFirstLegalMove(rewound, { row: 0, col: 7 }).state

    expect(rewritten.history).toHaveLength(3) // 起点 + 第一步 + 新的第二步
    expect(rewritten.cursor).toBe(2)
    expect(canSandboxGoForward(rewritten)).toBe(false)
  })

  it('吃子时会把 captured 报出来', () => {
    // 红车沿 9 路直接吃掉黑方的卒。两个将要错开列，否则将帅照面属于非法局面，红方一步都走不了
    const { board, sideToMove } = parseFen('3ka4/9/9/p8/9/9/9/9/9/R3K4 w - - 0 1')
    const start = createSandbox(board, sideToMove)
    const selected = clickSandboxSquare(start, { row: 9, col: 0 }).state
    const target = selected.selection.legalTargets.find((t) => t.row === 3 && t.col === 0)
    expect(target).toBeDefined()

    const after = clickSandboxSquare(selected, target!)
    expect(after.moved).toEqual({ captured: true })
  })
})
