// 把整局分析里已经走出的线性棋路，存成一条「整局」案例（案例库里可再改名、挪文件夹）。

import type { StudyCase } from '@shared/moveTree'
import type { GameHistoryEntry } from './useFullGameAnalysis'

export interface HistoryMoveToSave {
  move: string
  moveCoord: string
  boardStateFEN: string
}

/** 跳过第 0 步起始局面，后面每一步对应棋谱树上的一个子节点 */
export function historyMovesToSave(history: GameHistoryEntry[]): HistoryMoveToSave[] {
  const moves: HistoryMoveToSave[] = []
  for (let i = 1; i < history.length; i++) {
    const entry = history[i]
    if (!entry.moveNotation || !entry.moveCoord) continue
    moves.push({
      move: entry.moveNotation,
      moveCoord: entry.moveCoord,
      boardStateFEN: entry.fen
    })
  }
  return moves
}

export async function collectFullGameToLibrary(
  history: GameHistoryEntry[],
  title: string,
  folderId: string | null
): Promise<StudyCase> {
  const studyCase = await window.chessoc.moveTree.createStudyCase({
    type: 'fullgame',
    title,
    folderId
  })
  let parentId = studyCase.rootNode.id
  for (const move of historyMovesToSave(history)) {
    const node = await window.chessoc.moveTree.createMoveNode({
      parentId,
      move: move.move,
      moveCoord: move.moveCoord,
      boardStateFEN: move.boardStateFEN
    })
    parentId = node.id
  }
  return studyCase
}
