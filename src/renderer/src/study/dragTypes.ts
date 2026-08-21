// 摆局阶段拖拽棋子用的数据载荷格式。单独抽出来是因为"拖拽区"（PlacementTray）
// 和"棋盘"（BoardView）分别在两个文件里，双方都要按同一个约定读写dataTransfer。

import type { DragEvent } from 'react'
import type { PieceKind, Position, Side } from '@shared/chess'

const PIECE_DRAG_MIME = 'application/x-chessoc-piece'

export interface PieceDragPayload {
  kind: PieceKind
  side: Side
  /** 如果是从棋盘上的某个格子拖出来的（而不是从摆放区拖来的新子），记录原始位置，落地后要把原位置清空 */
  fromBoard?: Position
}

export function setPieceDragData(event: DragEvent, payload: PieceDragPayload): void {
  event.dataTransfer.setData(PIECE_DRAG_MIME, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = 'move'
}

export function readPieceDragData(event: DragEvent): PieceDragPayload | null {
  const raw = event.dataTransfer.getData(PIECE_DRAG_MIME)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PieceDragPayload
  } catch {
    return null
  }
}
