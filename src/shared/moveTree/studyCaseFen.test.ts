import { EMPTY_BOARD_FEN, STANDARD_START_FEN } from '@shared/chess'
import { describe, expect, it } from 'vitest'
import { initialFenForStudyCase } from './studyCaseFen'

describe('initialFenForStudyCase', () => {
  it('整局从标准开局起手，中局残局从空棋盘摆局', () => {
    expect(initialFenForStudyCase('fullgame')).toBe(STANDARD_START_FEN)
    expect(initialFenForStudyCase('midgame')).toBe(EMPTY_BOARD_FEN)
    expect(initialFenForStudyCase('endgame')).toBe(EMPTY_BOARD_FEN)
  })
})
