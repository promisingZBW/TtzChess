// 摆局阶段的棋子摆放区（dev guide 5.5节）：红黑双方各7种棋子的图标，拖到棋盘上=放置；
// 把棋盘上的子拖回这里、或者双击棋盘上的子=删除。也可以按数字键选中（1-7红方，Shift+1-7黑方），
// 再左键点棋盘落下。这个组件本身不关心棋盘状态。

import type { Piece, PieceKind, Position, Side } from '@shared/chess'
import { getPieceLabel } from '@shared/chess'
import { readPieceDragData, setPieceDragData } from './dragTypes'
import { PLACEMENT_NUMBER_KEYS } from './useKeyboardPlacement'

interface PlacementTrayProps {
  onRemoveFromBoard: (pos: Position) => void
  heldPiece: Piece | null
  onSelectPiece: (piece: Piece | null) => void
}

function TrayPiece({
  kind,
  side,
  digit,
  selected,
  onSelect
}: {
  kind: PieceKind
  side: Side
  digit: string
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const label = getPieceLabel({ kind, side })
  const hint = side === 'black' ? `⇧${digit}` : digit
  return (
    <div className={`tray-piece-wrap${selected ? ' tray-piece-wrap-selected' : ''}`}>
      <div
        className={`tray-piece piece-${side}`}
        draggable
        onDragStart={(e) => setPieceDragData(e, { kind, side })}
        onClick={onSelect}
        title={`${label}（快捷键 ${hint}）`}
        role="button"
        aria-label={`摆放${label}`}
        tabIndex={0}
      >
        {label}
      </div>
      <span className="tray-piece-key">{hint}</span>
    </div>
  )
}

export function PlacementTray({ onRemoveFromBoard, heldPiece, onSelectPiece }: PlacementTrayProps): React.JSX.Element {
  function toggle(kind: PieceKind, side: Side): void {
    if (heldPiece && heldPiece.kind === kind && heldPiece.side === side) {
      onSelectPiece(null)
      return
    }
    onSelectPiece({ kind, side })
  }

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
        按 1–7 选红子、Shift+1–7 选黑子，再左键点棋盘放下。也可以拖拽。Esc 取消选中。
      </p>
      <div className="placement-tray-side">
        <span className="placement-tray-side-label">红方</span>
        <div className="placement-tray-pieces">
          {PLACEMENT_NUMBER_KEYS.map(({ digit, kind }) => (
            <TrayPiece
              key={`red-${kind}`}
              kind={kind}
              side="red"
              digit={digit}
              selected={heldPiece?.kind === kind && heldPiece.side === 'red'}
              onSelect={() => toggle(kind, 'red')}
            />
          ))}
        </div>
      </div>
      <div className="placement-tray-side">
        <span className="placement-tray-side-label">黑方</span>
        <div className="placement-tray-pieces">
          {PLACEMENT_NUMBER_KEYS.map(({ digit, kind }) => (
            <TrayPiece
              key={`black-${kind}`}
              kind={kind}
              side="black"
              digit={digit}
              selected={heldPiece?.kind === kind && heldPiece.side === 'black'}
              onSelect={() => toggle(kind, 'black')}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
