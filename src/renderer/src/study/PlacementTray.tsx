// 摆局阶段的棋子摆放区（dev guide 5.5节）：红黑双方各7种棋子的图标，拖到棋盘上=放置；
// 把棋盘上的子拖回这里、或者双击棋盘上的子=删除。这个组件本身不关心棋盘状态，
// 只负责"拖拽源"（新棋子）和"拖拽目标"（接收从棋盘拖回来的子并转发删除请求）。

import type { PieceKind, Position, Side } from '@shared/chess'
import { getPieceLabel } from '@shared/chess'
import { readPieceDragData, setPieceDragData } from './dragTypes'

interface PlacementTrayProps {
  onRemoveFromBoard: (pos: Position) => void
}

const PIECE_KINDS: PieceKind[] = ['K', 'A', 'B', 'N', 'R', 'C', 'P']

function TrayPiece({ kind, side }: { kind: PieceKind; side: Side }): React.JSX.Element {
  const label = getPieceLabel({ kind, side })
  return (
    <div
      className={`tray-piece piece-${side}`}
      draggable
      onDragStart={(e) => setPieceDragData(e, { kind, side })}
      title={label}
      role="button"
      aria-label={`摆放${label}`}
      tabIndex={0}
    >
      {label}
    </div>
  )
}

export function PlacementTray({ onRemoveFromBoard }: PlacementTrayProps): React.JSX.Element {
  return (
    <div
      className="placement-tray"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const payload = readPieceDragData(e)
        if (payload?.fromBoard) onRemoveFromBoard(payload.fromBoard)
      }}
    >
      <p className="placement-tray-hint">
        把棋子拖到棋盘上摆放；把棋盘上的子拖回这个区域、或双击棋盘上的子＝删除。
      </p>
      <div className="placement-tray-side">
        <span className="placement-tray-side-label">红方</span>
        <div className="placement-tray-pieces">
          {PIECE_KINDS.map((kind) => (
            <TrayPiece key={`red-${kind}`} kind={kind} side="red" />
          ))}
        </div>
      </div>
      <div className="placement-tray-side">
        <span className="placement-tray-side-label">黑方</span>
        <div className="placement-tray-pieces">
          {PIECE_KINDS.map((kind) => (
            <TrayPiece key={`black-${kind}`} kind={kind} side="black" />
          ))}
        </div>
      </div>
    </div>
  )
}
