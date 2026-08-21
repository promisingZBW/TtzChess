// 子力价值表，数值和 xiangqi_feature_extraction.py 里的 PIECE_VALUES 保持一致（可自行调优），
// 阶段7"特征提取"用它来算子力差、判断"威胁"是否达到"高价值棋子"的门槛。

import type { PieceKind } from './types'

export const PIECE_VALUES: Record<PieceKind, number> = {
  R: 600,
  N: 270,
  C: 285,
  P: 30,
  B: 120,
  A: 120,
  K: 0
}

export function getPieceValue(kind: PieceKind): number {
  return PIECE_VALUES[kind]
}

/** 威胁检测的门槛：车/马/炮级别（价值>=270）才算"高价值棋子"，被威胁到才值得提示用户，见dev guide第9节 */
export const THREAT_VALUE_THRESHOLD = 270
