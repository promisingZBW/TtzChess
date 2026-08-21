// 负责回答"这台机器上，Pikafish引擎的可执行文件在哪"这个问题。
//
// 引擎二进制文件（含53MB的.nnue神经网络权重）不随git提交——见 resources/engines/README.md，
// 需要开发者自己先运行一次 `npm run setup:pikafish` 下载官方发布包。这个文件只负责"按当前
// 平台，从性能优先到兼容性优先排出一串候选路径"，具体启动时选哪一个由EngineService试跑决定：
// 排在前面的指令集变体（比如avx2）如果这台CPU不支持，进程会立刻崩溃退出，
// EngineService捕捉到这个情况后会自动换下一个候选，直到最保险的sse41-popcnt兜底。
import { existsSync } from 'node:fs'
import path from 'node:path'

export interface EngineCandidate {
  /** 可执行文件完整路径 */
  executablePath: string
  /** 具体是哪个CPU指令集变体，仅用于日志/状态展示，不影响功能 */
  label: string
  /** 正常的Pikafish二进制不需要任何启动参数；单元测试用这个字段让"假引擎"跑在node解释器下（node fakeEngine.mjs） */
  args?: string[]
}

export interface EngineInstallation {
  /** 引擎资源根目录，同时也是启动子进程时要设置的cwd——pikafish.nnue权重文件就放在这一层，
   * 引擎官方文档写明会自动搜索"可执行文件所在目录"和"进程当前工作目录"，不用额外传EvalFile参数 */
  engineRootDir: string
  /** 按"预期最快→最保险"排好序的候选列表，只包含真实存在于磁盘上的文件 */
  candidates: EngineCandidate[]
}

const VARIANTS_BY_PLATFORM: Partial<Record<NodeJS.Platform, { folder: string; variants: string[]; exeSuffix: string }>> = {
  win32: { folder: 'Windows', variants: ['avx2', 'bmi2', 'sse41-popcnt'], exeSuffix: '.exe' },
  linux: { folder: 'Linux', variants: ['avx2', 'bmi2', 'sse41-popcnt'], exeSuffix: '' },
  darwin: { folder: 'MacOS', variants: ['apple-silicon'], exeSuffix: '' }
}

export function resolveEngineRootDir(appRootDir: string): string {
  return path.join(appRootDir, 'resources', 'engines', 'pikafish')
}

/** 列出当前平台"理论上"的候选路径，不检查文件是否真的存在（方便单独测试路径拼接逻辑） */
export function listEngineCandidates(
  engineRootDir: string,
  platform: NodeJS.Platform = process.platform
): EngineCandidate[] {
  const config = VARIANTS_BY_PLATFORM[platform]
  if (!config) return []
  return config.variants.map((variant) => ({
    executablePath: path.join(engineRootDir, config.folder, `pikafish-${variant}${config.exeSuffix}`),
    label: variant
  }))
}

/** 过滤出磁盘上真实存在的候选文件；existsFn参数是为了单元测试时能注入假的文件系统判断 */
export function filterExistingCandidates(
  candidates: EngineCandidate[],
  existsFn: (filePath: string) => boolean = existsSync
): EngineCandidate[] {
  return candidates.filter((candidate) => existsFn(candidate.executablePath))
}

export function resolveEngineInstallation(
  engineRootDir: string,
  platform: NodeJS.Platform = process.platform,
  existsFn: (filePath: string) => boolean = existsSync
): EngineInstallation {
  const candidates = filterExistingCandidates(listEngineCandidates(engineRootDir, platform), existsFn)
  return { engineRootDir, candidates }
}
