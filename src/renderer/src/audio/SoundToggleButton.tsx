// 静音开关。只放一个喇叭图标，因为打谱页的工具栏已经排了五个按钮，再塞文字就该换行了。
//
// 三个会发出落子声的页面（打谱、单次分析、整局分析）各放一个。静音状态是全局的、
// 存在 localStorage 里，在哪一页关掉，其它页也跟着不响，下次开程序还记得。

import { useState } from 'react'
import { isSoundMuted, setSoundMuted } from './moveSounds'

export function SoundToggleButton(): React.JSX.Element {
  const [muted, setMuted] = useState(isSoundMuted)

  function toggle(): void {
    const next = !muted
    setSoundMuted(next)
    setMuted(next)
  }

  return (
    <button
      className="sound-toggle"
      onClick={toggle}
      title={muted ? '当前静音，点一下开启落子音效' : '关闭落子音效'}
      aria-label={muted ? '开启音效' : '静音'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
