/// <reference types="vite/client" />

import type { ChessOCBridge } from '@shared/ipc'

declare global {
  interface Window {
    chessoc: ChessOCBridge
  }
}
