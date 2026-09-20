// 导出文件到用户自己选的位置。目前只有"把棋谱树存成图片"一个用途。
//
// 保存对话框必须由主进程弹（渲染进程拿不到 Electron 的 dialog），图片的像素数据则只有
// 渲染进程画得出来（canvas 是浏览器能力），所以分工是：渲染进程把 PNG 转成 base64 传过来，
// 主进程负责问用户存哪儿、然后写盘。

import { dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { EXPORT_CHANNELS, type SaveImageResult } from '@shared/ipc'

export function registerExportIpc(): void {
  ipcMain.handle(
    EXPORT_CHANNELS.savePngImage,
    async (_event, defaultFileName: string, base64: string): Promise<SaveImageResult> => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: '保存棋谱树图片',
        defaultPath: defaultFileName,
        filters: [{ name: 'PNG 图片', extensions: ['png'] }]
      })
      if (canceled || !filePath) return { saved: false }

      await writeFile(filePath, Buffer.from(base64, 'base64'))
      return { saved: true, filePath }
    }
  )
}
