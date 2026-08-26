// 胜率数字的统一展示：百分比用「排除和棋」的算法，括号里仍给出千分制胜/和/负。
// 鼠标悬停在数字上会看到计算公式，避免用户误以为 7% 就是「几乎必输」。

import type { EngineWdl } from '@shared/engine'
import type { Side } from '@shared/chess'
import {
  WIN_RATE_FORMULA_HINT,
  wdlFromPerspective,
  winRatePercentFromPerspective
} from './singlePositionAnalysis'

interface WinRateValueProps {
  wdl: EngineWdl
  wdlSide: Side
  perspective: Side
  /** 不传则只显示 "xx%"；传了会在后面补上（胜x 和x 负x，千分制） */
  showCounts?: boolean
}

export function WinRateValue({
  wdl,
  wdlSide,
  perspective,
  showCounts = true
}: WinRateValueProps): React.JSX.Element {
  const percent = winRatePercentFromPerspective(wdl, wdlSide, perspective)
  const [win, draw, loss] = wdlFromPerspective(wdl, wdlSide, perspective)
  return (
    <span className="win-rate-value" title={WIN_RATE_FORMULA_HINT}>
      <strong>{percent}%</strong>
      {showCounts && (
        <span className="win-rate-counts">
          （胜{win} 和{draw} 负{loss}，千分制）
        </span>
      )}
      <span className="win-rate-tooltip" role="tooltip">
        {WIN_RATE_FORMULA_HINT}
      </span>
    </span>
  )
}
