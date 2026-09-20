// 落子音效：播放 src/renderer/src/sounds 下那段实录的棋子声，每走一步响一下。
//
// 早先这里是用 Web Audio 现场合成的（噪声+低频），听着有电子味，换成实录的了。
//
// 为什么用 Web Audio 解码播放、而不是简单地 new Audio().play()：
// HTMLAudioElement 同一个实例没播完就再次 play() 会把前一次掐断，连着快速走子会吞音；
// 每次新建一个实例又要重新解码这 48KB，还会攒下一堆待回收的元素。
// 这里只解码一次、把 AudioBuffer 缓存起来，之后每响一次就挂一个新的 BufferSource，
// 几个音互相叠着放也没问题，延迟也最低。
//
// 浏览器/Electron 都不允许页面在用户交互前出声，所以 AudioContext 延迟到第一次
// 真正要放音（也就是用户点了棋盘之后）才创建，不在模块加载时就建。

import voiceUrl from '../sounds/voice.wav'

const MUTE_STORAGE_KEY = 'ttzchess-sound-muted'

let audioContext: AudioContext | null = null
let decoded: AudioBuffer | null = null
let decoding: Promise<AudioBuffer | null> | null = null
let muted = readMutedFromStorage()

// 音频文件本身不用等 AudioContext，页面一加载就可以先抓回来放着，
// 这样第一步棋落下时只剩解码，不用再等网络/磁盘
const rawBytes: Promise<ArrayBuffer | null> = fetch(voiceUrl)
  .then((res) => (res.ok ? res.arrayBuffer() : null))
  .catch(() => null)

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

/** 解码只做一次，之后直接复用同一个 AudioBuffer */
function loadBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (decoded) return Promise.resolve(decoded)
  if (!decoding) {
    decoding = rawBytes
      .then((bytes) => (bytes ? ctx.decodeAudioData(bytes.slice(0)) : null))
      .then((buffer) => {
        decoded = buffer
        return buffer
      })
      .catch(() => null)
  }
  return decoding
}

/** 走完一步棋就响一下。静音时什么都不做，放音失败也只是没声音，不影响走棋 */
export function playMoveSound(): void {
  if (muted) return
  const ctx = getContext()
  if (!ctx) return

  void loadBuffer(ctx).then((buffer) => {
    // 解码是异步的，等回来的时候用户可能已经点了静音
    if (!buffer || muted || !audioContext) return
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(audioContext.destination)
    source.start()
  })
}
