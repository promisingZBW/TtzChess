// 整局分析的胜率折线图（dev guide 7.2节）：横轴=步数，纵轴=胜率(0-100%)。
// 用d3只算比例尺和画线路径，SVG本身还是手写的（和MoveTreePanel、BoardView一个路数，
// 这个项目里"要不要用某个UI库的图表组件"统一按"自己拿d3算布局、自己画SVG"来处理，不引入额外的图表依赖）。

import { useMemo } from 'react'
import { line as d3Line, scaleLinear } from 'd3'
import type { GameHistoryEntry } from './useFullGameAnalysis'

const WIDTH = 560
const HEIGHT = 200
const PADDING = { top: 16, right: 16, bottom: 28, left: 36 }

interface WinRateChartProps {
  history: GameHistoryEntry[]
  viewingIndex: number
  onSelectIndex: (index: number) => void
}

export function WinRateChart({ history, viewingIndex, onSelectIndex }: WinRateChartProps): React.JSX.Element {
  const innerWidth = WIDTH - PADDING.left - PADDING.right
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom

  const xScale = useMemo(
    () =>
      scaleLinear()
        .domain([0, Math.max(1, history.length - 1)])
        .range([0, innerWidth]),
    [history.length, innerWidth]
  )
  const yScale = useMemo(() => scaleLinear().domain([0, 100]).range([innerHeight, 0]), [innerHeight])

  const linePath = useMemo(() => {
    const generator = d3Line<GameHistoryEntry & { index: number }>()
      .defined((d) => typeof d.winRatePercent === 'number')
      .x((d) => xScale(d.index))
      .y((d) => yScale(d.winRatePercent as number))
    return generator(history.map((entry, index) => ({ ...entry, index })))
  }, [history, xScale, yScale])

  return (
    <svg className="win-rate-chart" width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(${PADDING.left}, ${PADDING.top})`}>
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick} transform={`translate(0, ${yScale(tick)})`}>
            <line className="win-rate-chart-gridline" x1={0} x2={innerWidth} y1={0} y2={0} />
            <text className="win-rate-chart-tick" x={-8} y={0} dominantBaseline="middle" textAnchor="end">
              {tick}%
            </text>
          </g>
        ))}

        {linePath && <path className="win-rate-chart-line" d={linePath} />}

        {history.map((entry, index) => {
          if (typeof entry.winRatePercent !== 'number') return null
          return (
            <circle
              key={index}
              className={`win-rate-chart-point${index === viewingIndex ? ' win-rate-chart-point-active' : ''}`}
              cx={xScale(index)}
              cy={yScale(entry.winRatePercent)}
              r={index === viewingIndex ? 6 : 4}
              onClick={() => onSelectIndex(index)}
            />
          )
        })}
      </g>
    </svg>
  )
}
