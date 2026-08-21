import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { filterExistingCandidates, listEngineCandidates, resolveEngineInstallation } from '../pikafishLocator'

describe('listEngineCandidates', () => {
  it('Windows平台按"预期最快→最保险"排出候选路径', () => {
    const candidates = listEngineCandidates('C:\\app\\resources\\engines\\pikafish', 'win32')
    expect(candidates.map((c) => c.label)).toEqual(['avx2', 'bmi2', 'sse41-popcnt'])
    expect(candidates[0].executablePath).toBe(
      path.join('C:\\app\\resources\\engines\\pikafish', 'Windows', 'pikafish-avx2.exe')
    )
  })

  it('macOS平台目前只有apple-silicon这一个官方构建', () => {
    const candidates = listEngineCandidates('/app/resources/engines/pikafish', 'darwin')
    expect(candidates.map((c) => c.label)).toEqual(['apple-silicon'])
  })

  it('不支持的平台返回空列表，而不是抛异常', () => {
    expect(listEngineCandidates('/x', 'aix')).toEqual([])
  })
})

describe('filterExistingCandidates', () => {
  it('只保留existsFn判断为真实存在的候选', () => {
    const candidates = listEngineCandidates('/root', 'linux')
    const onlyBmi2Exists = (p: string): boolean => p.includes('bmi2')
    const filtered = filterExistingCandidates(candidates, onlyBmi2Exists)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].label).toBe('bmi2')
  })
})

describe('resolveEngineInstallation', () => {
  it('引擎目录不存在任何二进制时，candidates应为空数组（不是抛错）', () => {
    const installation = resolveEngineInstallation('/nowhere', 'win32', () => false)
    expect(installation.candidates).toEqual([])
    expect(installation.engineRootDir).toBe('/nowhere')
  })
})
