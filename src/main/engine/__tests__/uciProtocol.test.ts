import { describe, expect, it } from 'vitest'
import { parseBestMoveLine, parseUciInfoLine } from '../uciProtocol'

describe('parseUciInfoLine', () => {
  it('解析带wdl的普通分数info行', () => {
    const line =
      'info depth 5 seldepth 2 multipv 1 score cp 320 wdl 726 274 0 nodes 389 nps 129666 hashfull 0 tbhits 0 time 3 pv b2e2'
    const result = parseUciInfoLine(line)
    expect(result).toEqual({
      depth: 5,
      scoreCp: 320,
      isMate: false,
      mateIn: null,
      wdl: [726, 274, 0],
      pv: ['b2e2']
    })
  })

  it('解析多步pv', () => {
    const line = 'info depth 6 score cp 30 nodes 925 nps 231250 pv h2e2 h7e7 h0g2'
    const result = parseUciInfoLine(line)
    expect(result?.pv).toEqual(['h2e2', 'h7e7', 'h0g2'])
    expect(result?.wdl).toBeNull()
  })

  it('解析绝杀分数，换算成一个远超普通局面范围的大数', () => {
    const line = 'info depth 5 seldepth 2 multipv 1 score mate 1 nodes 34 nps 11333 time 3 pv e7d7'
    const result = parseUciInfoLine(line)
    expect(result?.isMate).toBe(true)
    expect(result?.mateIn).toBe(1)
    expect(result?.scoreCp).toBeGreaterThan(2000)
  })

  it('被杀的负数mate分数换算成负的大数', () => {
    const line = 'info depth 5 score mate -3 pv e7d7'
    const result = parseUciInfoLine(line)
    expect(result?.mateIn).toBe(-3)
    expect(result?.scoreCp).toBeLessThan(-2000)
  })

  it('不含pv字段的提示行（比如NNUE加载提示）应该被忽略，返回null', () => {
    expect(parseUciInfoLine('info string NNUE evaluation using pikafish.nnue enabled')).toBeNull()
  })

  it('不是info开头的行返回null', () => {
    expect(parseUciInfoLine('bestmove b2e2')).toBeNull()
  })
})

describe('parseBestMoveLine', () => {
  it('解析带ponder的bestmove行', () => {
    expect(parseBestMoveLine('bestmove b2e2 ponder b9c7')).toEqual({ bestMove: 'b2e2', ponder: 'b9c7' })
  })

  it('解析不带ponder的bestmove行', () => {
    expect(parseBestMoveLine('bestmove e7d7')).toEqual({ bestMove: 'e7d7', ponder: null })
  })

  it('无棋可走时的"(none)"要转成null', () => {
    expect(parseBestMoveLine('bestmove (none)')).toEqual({ bestMove: null, ponder: null })
  })

  it('不是bestmove开头的行返回null', () => {
    expect(parseBestMoveLine('info depth 1 pv b2e2')).toBeNull()
  })
})
