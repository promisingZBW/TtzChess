// 阶段6：把渲染进程发过来的"分析这个局面"请求转发给EngineService。
// 这一层同样不含业务逻辑，只是"IPC channel名 -> 调用EngineService哪个方法"的映射表，
// 和 moveTreeIpc.ts 是同一个套路。
import { ipcMain } from 'electron'
import { ENGINE_CHANNELS } from '@shared/ipc'
import type { EngineService } from '../engine'

export function registerEngineIpc(engineService: EngineService): void {
  ipcMain.handle(ENGINE_CHANNELS.analyzePosition, (_event, fen: string, depth?: number) =>
    engineService.analyzePosition(fen, depth)
  )
  ipcMain.handle(ENGINE_CHANNELS.getStatus, () => engineService.getStatus())
}
