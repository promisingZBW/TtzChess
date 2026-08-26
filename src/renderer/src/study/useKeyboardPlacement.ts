// 摆棋快捷方式：数字键 1-7 选中托盘里对应的棋子（Shift=黑方），鼠标变成这枚子，
// 再左键点棋盘格子即可放下。Esc 取消。和拖拽摆子并存，不互相取代。

import { useEffect, useState } from 'react'
import type { Piece, PieceKind } from '@shared/chess'

export const PLACEMENT_NUMBER_KEYS: Array<{ digit: string; kind: PieceKind; label: string }> = [
  { digit: '1', kind: 'K', label: '帅/将' },
  { digit: '2', kind: 'A', label: '仕/士' },
  { digit: '3', kind: 'B', label: '相/象' },
  { digit: '4', kind: 'N', label: '马' },
  { digit: '5', kind: 'R', label: '车' },
  { digit: '6', kind: 'C', label: '炮' },
  { digit: '7', kind: 'P', label: '兵/卒' }
]

export function kindForDigit(digit: string): PieceKind | null {
  return PLACEMENT_NUMBER_KEYS.find((item) => item.digit === digit)?.kind ?? null
}

export interface PointerPos {
  x: number
  y: number
}

export function useKeyboardPlacement(enabled: boolean): {
  heldPiece: Piece | null
  setHeldPiece: (piece: Piece | null) => void
  pointer: PointerPos | null
} {
  const [heldPiece, setHeldPiece] = useState<Piece | null>(null)
  const [pointer, setPointer] = useState<PointerPos | null>(null)

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      if (event.key === 'Escape') {
        setHeldPiece(null)
        return
      }

      const digitMatch = /^Digit([1-7])$/.exec(event.code)
      if (!digitMatch) return
      const kind = kindForDigit(digitMatch[1])
      if (!kind) return
      event.preventDefault()
      const side = event.shiftKey ? 'black' : 'red'
      setHeldPiece((prev) => (prev && prev.kind === kind && prev.side === side ? null : { kind, side }))
    }

    function onMouseMove(event: MouseEvent): void {
      setPointer({ x: event.clientX, y: event.clientY })
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousemove', onMouseMove)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [enabled])

  return { heldPiece: enabled ? heldPiece : null, setHeldPiece, pointer }
}
