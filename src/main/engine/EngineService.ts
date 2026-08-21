// 阶段6核心：管理一个长期存活的Pikafish子进程，把UCI协议的文本对话封装成一个
// `analyzePosition(fen)` 的Promise接口，供后续"AI分析"功能（阶段8）调用。
//
// 几个关键设计点（对应dev guide第8节的验收标准）：
// 1. 结果缓存：以"FEN+搜索深度"为key，命中缓存直接返回，不重新问引擎——这是第一版就要做的，
//    不是后置优化项。同一个key如果正好有一次查询正在进行中，后来的调用直接等那一次的结果，
//    不会真的对引擎发起第二次重复搜索。
// 2. 候选二进制自动降级：见 pikafishLocator.ts 的注释，某个指令集变体启动失败会自动换下一个。
// 3. 进程异常退出的错误处理：引擎进程崩溃/被杀掉，不会让整个Electron应用崩溃，
//    只是把当前排队等待的请求全部reject成明确的错误，状态机进入'crashed'，
//    下一次调用analyzePosition时会重新尝试启动（如果候选列表还有没试过的，或想重新给已死的进程一次机会）。
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { EngineAnalysisResult, EngineStatus } from '@shared/engine'
import { parseBestMoveLine, parseUciInfoLine, type UciBestMove } from './uciProtocol'
import type { EngineCandidate } from './pikafishLocator'

export const DEFAULT_ANALYSIS_DEPTH = 15
const DEFAULT_STARTUP_TIMEOUT_MS = 3000

interface PendingRequest {
  fen: string
  depth: number
  resolve: (result: EngineAnalysisResult) => void
  reject: (error: Error) => void
}

type ServiceState = 'idle' | 'starting' | 'ready' | 'busy' | 'crashed' | 'unavailable'

export interface EngineServiceOptions {
  engineRootDir: string
  candidates: EngineCandidate[]
  /** 单个候选二进制启动等待uciok的超时时间，单元测试里会传很小的值，避免测试跑很久 */
  startupTimeoutMs?: number
}

export class EngineService {
  private readonly engineRootDir: string
  private readonly candidates: EngineCandidate[]
  private readonly startupTimeoutMs: number

  private child: ChildProcessWithoutNullStreams | null = null
  private state: ServiceState = 'idle'
  private activeExecutablePath: string | null = null
  private lastError: string | null = null

  private stdoutBuffer = ''
  private current: PendingRequest | null = null
  private currentBestInfo: ReturnType<typeof parseUciInfoLine> = null
  private readonly queue: PendingRequest[] = []
  private readonly cache = new Map<string, EngineAnalysisResult>()
  private readonly inFlight = new Map<string, Promise<EngineAnalysisResult>>()
  private startingPromise: Promise<void> | null = null

  constructor(options: EngineServiceOptions) {
    this.engineRootDir = options.engineRootDir
    this.candidates = options.candidates
    this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS
    this.state = this.candidates.length === 0 ? 'unavailable' : 'idle'
  }

  getStatus(): EngineStatus {
    if (this.state === 'ready' || this.state === 'busy') {
      return { state: 'ready', executablePath: this.activeExecutablePath ?? '' }
    }
    if (this.state === 'starting') return { state: 'starting' }
    if (this.state === 'crashed') {
      return { state: 'error', reason: this.lastError ?? '引擎进程异常退出' }
    }
    if (this.candidates.length === 0) {
      return {
        state: 'unavailable',
        reason: '未找到Pikafish引擎二进制文件，请先运行 npm run setup:pikafish 下载'
      }
    }
    // state === 'idle'：已经找到候选二进制，只是还没真正启动过子进程（第一次调用analyzePosition时才会启动）
    return { state: 'unavailable', reason: '引擎尚未启动，调用一次分析会自动启动' }
  }

  async analyzePosition(fen: string, depth: number = DEFAULT_ANALYSIS_DEPTH): Promise<EngineAnalysisResult> {
    const cacheKey = `${fen}::depth${depth}`
    const cached = this.cache.get(cacheKey)
    if (cached) return { ...cached, fromCache: true }

    const existingInFlight = this.inFlight.get(cacheKey)
    if (existingInFlight) return existingInFlight

    const promise = this.runAnalysis(fen, depth, cacheKey)
    this.inFlight.set(cacheKey, promise)
    try {
      return await promise
    } finally {
      this.inFlight.delete(cacheKey)
    }
  }

  private async runAnalysis(fen: string, depth: number, cacheKey: string): Promise<EngineAnalysisResult> {
    if (this.candidates.length === 0) {
      throw new Error('未找到Pikafish引擎二进制文件，请先运行 npm run setup:pikafish 下载')
    }

    await this.ensureStarted()

    return new Promise<EngineAnalysisResult>((resolve, reject) => {
      this.queue.push({
        fen,
        depth,
        resolve: (result) => {
          this.cache.set(cacheKey, result)
          resolve(result)
        },
        reject
      })
      this.pumpQueue()
    })
  }

  /** 关闭时（应用退出/测试结束）杀掉引擎子进程，避免留下孤儿进程；顺带reject掉所有还没处理完的请求，避免调用方永远挂起 */
  dispose(): void {
    this.child?.removeAllListeners()
    this.child?.kill()
    this.child = null

    const failing = this.current ? [this.current, ...this.queue] : [...this.queue]
    this.queue.length = 0
    this.current = null
    this.currentBestInfo = null
    for (const req of failing) {
      req.reject(new Error('引擎服务已关闭'))
    }

    this.state = this.candidates.length === 0 ? 'unavailable' : 'idle'
  }

  private async ensureStarted(): Promise<void> {
    if (this.state === 'ready' || this.state === 'busy') return
    if (this.state === 'starting' && this.startingPromise) {
      return this.startingPromise
    }

    this.state = 'starting'
    this.startingPromise = this.startWithFallback()
    try {
      await this.startingPromise
    } finally {
      this.startingPromise = null
    }
  }

  private async startWithFallback(): Promise<void> {
    for (const candidate of this.candidates) {
      try {
        const child = await this.trySpawn(candidate)
        this.attachRunningChild(child)
        this.state = 'ready'
        this.activeExecutablePath = candidate.executablePath
        this.lastError = null
        return
      } catch (err) {
        this.lastError = `引擎变体「${candidate.label}」启动失败：${err instanceof Error ? err.message : String(err)}`
      }
    }
    this.state = 'crashed'
    throw new Error(this.lastError ?? '所有候选引擎二进制都无法启动')
  }

  private trySpawn(candidate: EngineCandidate): Promise<ChildProcessWithoutNullStreams> {
    return new Promise((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams
      try {
        child = spawn(candidate.executablePath, candidate.args ?? [], { cwd: this.engineRootDir })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
        return
      }

      let settled = false
      let buffer = ''

      const timeoutHandle = setTimeout(() => {
        if (settled) return
        settled = true
        cleanupProbeListeners()
        child.kill()
        reject(new Error(`启动超时（${this.startupTimeoutMs}ms内未收到uciok），可能是文件损坏或权限问题`))
      }, this.startupTimeoutMs)

      const onError = (err: Error): void => {
        if (settled) return
        settled = true
        clearTimeout(timeoutHandle)
        cleanupProbeListeners()
        reject(err)
      }
      const onEarlyExit = (code: number | null): void => {
        if (settled) return
        settled = true
        clearTimeout(timeoutHandle)
        cleanupProbeListeners()
        reject(new Error(`进程启动后立即退出（exit code ${code}），这个CPU可能不支持该指令集变体`))
      }
      const onStdoutData = (chunk: Buffer): void => {
        buffer += chunk.toString('utf-8')
        if (!buffer.includes('uciok')) return
        if (settled) return
        settled = true
        clearTimeout(timeoutHandle)
        cleanupProbeListeners()
        resolve(child)
      }

      function cleanupProbeListeners(): void {
        child.off('error', onError)
        child.off('exit', onEarlyExit)
        child.stdout.off('data', onStdoutData)
      }

      child.on('error', onError)
      child.on('exit', onEarlyExit)
      child.stdout.on('data', onStdoutData)
      child.stdin.write('uci\n')
    })
  }

  private attachRunningChild(child: ChildProcessWithoutNullStreams): void {
    this.child = child
    this.stdoutBuffer = ''
    child.stdin.write('setoption name UCI_ShowWDL value true\n')

    child.stdout.on('data', (chunk: Buffer) => this.handleStdout(chunk))
    child.once('exit', (code, signal) => this.handleCrash(`引擎进程退出（code=${code}, signal=${signal}）`))
    child.once('error', (err) => this.handleCrash(`引擎进程错误：${err.message}`))
  }

  private handleCrash(reason: string): void {
    if (this.child === null && this.state === 'crashed') return // 已经处理过一次，避免重复触发
    this.lastError = reason
    this.state = 'crashed'
    this.child = null

    const failing = this.current ? [this.current, ...this.queue] : [...this.queue]
    this.queue.length = 0
    this.current = null
    this.currentBestInfo = null
    for (const req of failing) {
      req.reject(new Error(reason))
    }
  }

  private handleStdout(chunk: Buffer): void {
    this.stdoutBuffer += chunk.toString('utf-8')
    const lines = this.stdoutBuffer.split('\n')
    this.stdoutBuffer = lines.pop() ?? ''
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue
      const info = parseUciInfoLine(line)
      if (info) {
        this.currentBestInfo = info
        continue
      }
      const best = parseBestMoveLine(line)
      if (best) this.finishCurrent(best)
    }
  }

  private finishCurrent(best: UciBestMove): void {
    const req = this.current
    if (!req) return
    this.current = null
    const info = this.currentBestInfo
    this.currentBestInfo = null

    const result: EngineAnalysisResult = {
      fen: req.fen,
      depth: info?.depth ?? req.depth,
      scoreCp: info?.scoreCp ?? 0,
      isMate: info?.isMate ?? false,
      mateIn: info?.mateIn ?? null,
      wdl: info?.wdl ?? [0, 1000, 0],
      pv: info?.pv ?? (best.bestMove ? [best.bestMove] : []),
      fromCache: false
    }
    req.resolve(result)

    this.state = 'ready'
    this.pumpQueue()
  }

  private pumpQueue(): void {
    if (this.current) return
    if (!this.child || this.state !== 'ready') return
    const next = this.queue.shift()
    if (!next) return

    this.current = next
    this.state = 'busy'
    this.child.stdin.write(`position fen ${next.fen}\n`)
    this.child.stdin.write(`go depth ${next.depth}\n`)
  }
}
