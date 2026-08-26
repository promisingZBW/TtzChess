import { EMPTY_BOARD_FEN, STANDARD_START_FEN } from '@shared/chess'
import type { StudyCaseType } from './types'

/** 整局从标准开局起手；中局/残局仍从空棋盘摆局 */
export function initialFenForStudyCase(type: StudyCaseType): string {
  return type === 'fullgame' ? STANDARD_START_FEN : EMPTY_BOARD_FEN
}
