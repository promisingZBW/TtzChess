import { getPieceLabel } from '@shared/chess'
import type { Piece } from '@shared/chess'
import type { PointerPos } from './useKeyboardPlacement'

export function PlacementGhost({
  piece,
  pointer
}: {
  piece: Piece
  pointer: PointerPos | null
}): React.JSX.Element | null {
  if (!pointer) return null
  return (
    <div
      className={`placement-ghost piece-${piece.side}`}
      style={{ left: pointer.x, top: pointer.y }}
    >
      {getPieceLabel(piece)}
    </div>
  )
}
