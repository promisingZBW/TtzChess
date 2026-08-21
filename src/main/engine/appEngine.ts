// 真正在Electron里创建EngineService时，用哪个目录当"引擎资源根目录"：
// 开发模式下是项目根目录下的 resources/engines/pikafish；打包之后electron-builder会把
// extraResources拷到 process.resourcesPath 下，这里做了区分，方便以后配置打包脚本时能直接对上。
//
// 和 appDatabase.ts 是同一个思路：核心逻辑（EngineService/pikafishLocator）完全不依赖
// electron模块，可以脱离Electron单独用普通Node测试；只有这一个文件在main进程入口里用一次，
// 负责"填上Electron环境相关的具体路径"。
import { app } from 'electron'
import path from 'node:path'
import { EngineService } from './EngineService'
import { resolveEngineInstallation, resolveEngineRootDir } from './pikafishLocator'

function computeEngineRootDir(): string {
  if (app.isPackaged) {
    // 对应以后配置 electron-builder 的 extraResources: { from: 'resources/engines/pikafish', to: 'engines/pikafish' }
    return path.join(process.resourcesPath, 'engines', 'pikafish')
  }
  return resolveEngineRootDir(app.getAppPath())
}

export function createAppEngineService(): EngineService {
  const installation = resolveEngineInstallation(computeEngineRootDir())
  return new EngineService(installation)
}
