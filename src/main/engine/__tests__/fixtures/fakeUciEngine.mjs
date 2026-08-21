// 给 EngineService 单元测试用的假引擎：只实现"能让EngineService跑通完整流程"所需的最小UCI子集，
// 不是真的下棋逻辑。这样测试不用依赖55MB的真实Pikafish二进制（那个文件不随git提交，
// 见 resources/engines/README.md），CI/任何人clone下来直接跑npm test都不受影响。
//
// 通过环境变量控制这次运行的行为，模拟EngineService需要处理的几种真实场景：
//   FAKE_ENGINE_MODE=normal（默认）  正常应答uci/go，返回一个固定的分析结果
//   FAKE_ENGINE_MODE=crash-on-start  启动阶段就直接非0退出，模拟"CPU不支持这个指令集变体"
//   FAKE_ENGINE_MODE=hang-on-start   启动后不回复uciok，模拟进程卡死，用于测试启动超时兜底
//   FAKE_ENGINE_MODE=crash-after-ready 正常完成一次uci握手之后，再收到position/go命令时直接退出
import { createInterface } from 'node:readline'

const mode = process.argv[2] ?? process.env.FAKE_ENGINE_MODE ?? 'normal'

if (mode === 'crash-on-start') {
  process.exit(1)
}

if (mode === 'hang-on-start') {
  // 什么都不做、也不退出，靠测试自己控制超时之后kill掉这个进程
  setInterval(() => {}, 1000)
} else {
  const rl = createInterface({ input: process.stdin })

  rl.on('line', (line) => {
    const trimmed = line.trim()
    if (trimmed === 'uci') {
      process.stdout.write('id name FakePikafish\n')
      process.stdout.write('option name UCI_ShowWDL type check default false\n')
      process.stdout.write('uciok\n')
      return
    }
    if (trimmed.startsWith('setoption')) {
      return
    }
    if (trimmed.startsWith('position')) {
      return
    }
    if (trimmed.startsWith('go')) {
      if (mode === 'crash-after-ready') {
        process.exit(1)
      }
      const depthMatch = trimmed.match(/depth (\d+)/)
      const depth = depthMatch ? depthMatch[1] : '15'
      process.stdout.write(
        `info depth ${depth} seldepth ${depth} multipv 1 score cp 23 wdl 500 450 50 nodes 1000 nps 500000 hashfull 0 tbhits 0 time 2 pv h2e2 h9g7 h0g2\n`
      )
      process.stdout.write('bestmove h2e2 ponder h9g7\n')
      return
    }
    if (trimmed === 'quit') {
      process.exit(0)
    }
  })
}
