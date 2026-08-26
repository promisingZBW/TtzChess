import { describe, expect, it } from 'vitest'
import { parseFen, STANDARD_START_FEN } from '@shared/chess'
import { historyMovesToSave } from './collectFullGame'
import type { GameHistoryEntry } from './useFullGameAnalysis'

const AFTER_CANNON_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b - - 0 1'

function entry(fen: string, moveNotation: string | null, moveCoord: string | null): GameHistoryEntry {
  const { board, sideToMove } = parseFen(fen)
  return {
    fen,
    board,
    sideToMove,
    moveNotation,
    moveCoord,
    winRatePercent: 50,
    wdl: [400, 200, 400]
  }
}

describe('historyMovesToSave', () => {
  it('跳过起始局面，只留下已经走出的棋', () => {
    const history: GameHistoryEntry[] = [
      entry(STANDARD_START_FEN, null, null),
      entry(AFTER_CANNON_FEN, '炮二平五', 'h2e2')
    ]
    expect(historyMovesToSave(history)).toEqual([
      { move: '炮二平五', moveCoord: 'h2e2', boardStateFEN: AFTER_CANNON_FEN }
    ])
  })

  it('只有起始局面时没有可收藏的走法', () => {
    expect(historyMovesToSave([entry(STANDARD_START_FEN, null, null)])).toEqual([])
  })
})
