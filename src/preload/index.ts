import { contextBridge } from 'electron'
import type { ChessOCBridge } from '../shared/ipc'

const api: ChessOCBridge = {
  appName: 'ChessOC',
  versions: {
    electron: process.versions.electron ?? '',
    chrome: process.versions.chrome ?? '',
    node: process.versions.node ?? ''
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('chessoc', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // 未开启上下文隔离时的兼容分支，正式产品里不应该走到这里
  // @ts-expect-error 仅兼容分支使用
  window.chessoc = api
}
