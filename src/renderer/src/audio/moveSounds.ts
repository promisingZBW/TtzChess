// 落子音效。用 Web Audio 现场合成，不带任何音频文件。
//
// 为什么不用现成的音频素材：一是网上找的象棋音效基本都有版权，打进安装包不合适；
// 二是三个几十 KB 的 wav 也要进 asar，而合成出来的效果对"木头子敲在木板上"这种
// 短促的声音已经够用了——本来就是一声闷响，没有旋律可言。
//
// 合成思路：一段极短的噪声（模拟敲击的那一下摩擦声）+ 一个快速衰减的低频正弦
// （模拟木头的共鸣），两个加起来就是"嗒"。吃子比落子更响、频率更低一点，听起来更"重"；
// 将军用两声连击，和前两者区分开。
//
// 浏览器/Electron 都不允许页面在用户交互前出声，所以 AudioContext 延迟到第一次
// 真正要放音（也就是用户点了棋盘之后）才创建，不在模块加载时就建。

const MUTE_STORAGE_KEY = 'ttzchess-sound-muted'

let audioContext: AudioContext | null = null
let muted = readMutedFromStorage()

function readMutedFromStorage(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1'
  } catch {
    // 隐私模式/禁用了站点数据时 localStorage 会直接抛错，静音状态就退回默认的"开声音"
    return false
  }
}

export function isSoundMuted(): boolean {
  return muted
}

export function setSoundMuted(next: boolean): void {
  muted = next
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0')
  } catch {
    // 存不下就只在本次会话生效，不影响放音本身
  }
}

function getContext(): AudioContext | null {
  if (muted) return null
  if (!audioContext) {
    try {
      audioContext = new AudioContext()
    } catch {
      return null // 拿不到音频设备（比如没有声卡）就干脆不出声，不该让走棋失败
    }
  }
  // 窗口失焦一段时间后上下文可能被挂起，恢复它才有声音
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

/** 一小段白噪声，就是敲击瞬间那下"擦"的声音 */
function playNoiseBurst(ctx: AudioContext, at: number, durationSec: number, gainValue: number): void {
  const frameCount = Math.max(1, Math.floor(ctx.sampleRate * durationSec))
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frameCount; i++) {
    // 越往后越轻，避免听起来像"嘶"的一声长噪音
    data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount)
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  // 掐掉低频和高频，剩下中频，听感就从"沙沙"变成"哒"
  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 1800
  bandpass.Q.value = 0.8

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(gainValue, at)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + durationSec)

  source.connect(bandpass).connect(gain).connect(ctx.destination)
  source.start(at)
  source.stop(at + durationSec)
}

/** 快速衰减的低频，木头被敲出来的那点共鸣 */
function playThump(ctx: AudioContext, at: number, frequency: number, gainValue: number): void {
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(frequency, at)
  // 音高往下掉一点，听起来才像敲实心物体，而不是电子音
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.6, at + 0.08)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(gainValue, at)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09)

  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + 0.1)
}

function clack(ctx: AudioContext, at: number, frequency: number, volume: number): void {
  playNoiseBurst(ctx, at, 0.03, 0.18 * volume)
  playThump(ctx, at, frequency, 0.28 * volume)
}

/**
 * 走完一步棋之后放音。三种声音：普通落子、吃子（更重）、将军（两声）。
 * 吃子同时将军时按将军处理——将军是更重要的信息。
 */
export function playMoveSound(options: { captured: boolean; check: boolean }): void {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime

  if (options.check) {
    clack(ctx, now, 260, 1)
    clack(ctx, now + 0.12, 340, 0.9)
    return
  }
  if (options.captured) {
    clack(ctx, now, 190, 1.15)
    return
  }
  clack(ctx, now, 260, 0.85)
}
