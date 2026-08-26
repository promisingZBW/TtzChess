// 用一个假的"UCI引擎"（见 fixtures/fakeUciEngine.mjs）而不是真实Pikafish二进制来测试
// EngineService的进程管理/协议解析/缓存/错误处理逻辑——真实二进制55MB不随git提交，
// 必须先手动运行 `npm run setup:pikafish` 才会存在，测试不能依赖这一步，否则任何人
// clone仓库下来直接跑 `npm test` 就会失败。
//
// 假引擎的具体行为通过命令行参数控制（而不是环境变量），这样"一个候选崩溃、换下一个候选"
// 这种场景可以让两个候选各自带不同的参数、各自表现出不同的行为。
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { EngineService } from '../EngineService'
import type { EngineCandidate } from '../pikafishLocator'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'fakeUciEngine.mjs')
const FIXTURE_DIR = path.dirname(FIXTURE_PATH)

function fakeCandidate(mode: string, label = 'fake'): EngineCandidate {
  return { executablePath: process.execPath, args: [FIXTURE_PATH, mode], label }
}

const STANDARD_START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'

let service: EngineService | null = null

afterEach(() => {
  service?.dispose()
  service = null
})

describe('EngineService', () => {
  it('给定FEN能拿到PV和WDL', async () => {
    service = new EngineService({ engineRootDir: FIXTURE_DIR, candidates: [fakeCandidate('normal')] })
    const result = await service.analyzePosition(STANDARD_START_FEN, 5)
    expect(result.pv).toEqual(['h2e2', 'h9g7', 'h0g2'])
    expect(result.wdl).toEqual([500, 450, 50])
    expect(result.scoreCp).toBe(23)
    expect(result.fromCache).toBe(false)
    expect(service.getStatus()).toEqual({ state: 'ready', executablePath: process.execPath })
  })

  it('对同一FEN重复调用命中缓存，不会真的再问一次引擎', async () => {
    service = new EngineService({ engineRootDir: FIXTURE_DIR, candidates: [fakeCandidate('normal')] })
    const first = await service.analyzePosition(STANDARD_START_FEN, 5)
    expect(first.fromCache).toBe(false)

    // 缓存命中之后就把假引擎杀掉：如果第二次调用还能拿到正确结果，说明确实没有真的再触发一次引擎查询
    service.dispose()

    const second = await service.analyzePosition(STANDARD_START_FEN, 5)
    expect(second.fromCache).toBe(true)
    expect(second.pv).toEqual(first.pv)
  })

  it('不同深度不共用缓存', async () => {
    service = new EngineService({ engineRootDir: FIXTURE_DIR, candidates: [fakeCandidate('normal')] })
    const depth5 = await service.analyzePosition(STANDARD_START_FEN, 5)
    const depth10 = await service.analyzePosition(STANDARD_START_FEN, 10)
    expect(depth5.fromCache).toBe(false)
    expect(depth10.fromCache).toBe(false)
  })

  it('并发请求同一个FEN只会真正触发一次引擎查询（合并进行中的请求）', async () => {
    service = new EngineService({ engineRootDir: FIXTURE_DIR, candidates: [fakeCandidate('normal')] })
    const [a, b] = await Promise.all([
      service.analyzePosition(STANDARD_START_FEN, 8),
      service.analyzePosition(STANDARD_START_FEN, 8)
    ])
    expect(a).toEqual(b)
  })

  it('候选二进制启动失败时自动换下一个候选', async () => {
    service = new EngineService({
      engineRootDir: FIXTURE_DIR,
      candidates: [fakeCandidate('crash-on-start', 'crashing-variant'), fakeCandidate('normal', 'working-variant')],
      startupTimeoutMs: 2000
    })
    const result = await service.analyzePosition(STANDARD_START_FEN, 5)
    expect(result.pv).toEqual(['h2e2', 'h9g7', 'h0g2'])
    expect(service.getStatus()).toMatchObject({ state: 'ready' })
  })

  it('没有任何候选二进制时，直接给出明确的错误信息', async () => {
    service = new EngineService({ engineRootDir: FIXTURE_DIR, candidates: [] })
    await expect(service.analyzePosition(STANDARD_START_FEN)).rejects.toThrow(/setup:pikafish/)
    expect(service.getStatus().state).toBe('unavailable')
  })

  it('有候选但还没启动时，状态是 idle，不是 unavailable', () => {
    service = new EngineService({ engineRootDir: FIXTURE_DIR, candidates: [fakeCandidate('normal')] })
    expect(service.getStatus()).toEqual({ state: 'idle' })
  })

  it('所有候选都启动失败时，报错信息里能看到具体原因，而不是静默挂起', async () => {
    service = new EngineService({
      engineRootDir: FIXTURE_DIR,
      candidates: [fakeCandidate('crash-on-start', 'only-candidate')],
      startupTimeoutMs: 2000
    })
    await expect(service.analyzePosition(STANDARD_START_FEN)).rejects.toThrow(/启动失败/)
    expect(service.getStatus().state).toBe('error')
  })

  it('引擎进程运行中途崩溃，正在排队的请求会被reject而不是永远挂起', async () => {
    service = new EngineService({ engineRootDir: FIXTURE_DIR, candidates: [fakeCandidate('crash-after-ready')] })
    // 假引擎的crash-after-ready模式：uci握手能正常完成，但收到position/go之后立刻退出，
    // 用来模拟"引擎进程运行中途突然崩溃"这种场景
    await expect(service.analyzePosition(STANDARD_START_FEN, 5)).rejects.toThrow()
    expect(service.getStatus().state).toBe('error')
  })

  it('启动超时（假引擎故意不回复uciok）会被当成启动失败处理，而不是一直挂起', async () => {
    service = new EngineService({
      engineRootDir: FIXTURE_DIR,
      candidates: [fakeCandidate('hang-on-start', 'hanging-variant')],
      startupTimeoutMs: 300
    })
    await expect(service.analyzePosition(STANDARD_START_FEN)).rejects.toThrow(/启动失败/)
  })
})
