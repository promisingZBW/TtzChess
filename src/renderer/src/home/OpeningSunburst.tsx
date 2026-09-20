// 开局径向图（用户反馈后的修正版设计）：多个中心点并列展示，一个中心点=一种起手棋子类型。
// 每个中心点是一张"星形图"：中心是棋子图标，用户每创建一条独立命名的棋路，就从中心延伸出
// 一根线，线的末端是一个可点击的小球，球边上标着这条棋路的谱名。棋路之间完全独立、不嵌套——
// 一条棋路内部有多少步、多少分支，径向图上都只表现为一个球，具体走法要点进球才能看到。
//
// 点击行为区分：
// - 点击中心点本身（圆心那颗棋子图标）-> 创建新棋路（弹窗输入谱名）
// - 点击某条棋路对应的小球（或它的连线）-> 直接进入这条棋路的打谱详情界面

import { useMemo } from 'react'
import type { OpeningPieceType } from '@shared/moveTree'
import { getPieceLabel } from '@shared/chess'
import type { SunburstCenterData, SunburstStudyNode } from './openingSunburstUtils'

// 一屏只画一个中心点，所以画布可以开得很大，谱名再长也铺得开。
// 画布做成横着的长方形而不是正方形：左右两根辐条上的谱名是横着写的，
// 正方形画布会把它们顶出边界裁掉（谱名一长就更明显）。
const CANVAS_W = 900
const CANVAS_H = 560
const CENTER_X = CANVAS_W / 2
const CENTER_Y = CANVAS_H / 2
const HUB_RADIUS = 58
const SPOKE_LENGTH = 160
const BALL_RADIUS = 15
const LABEL_GAP = 16

interface SpokeLayout {
  study: SunburstStudyNode
  angle: number
}

/** 从正上方开始，顺时针把整圈平均分给每一条棋路——几条棋路就平分成几份 */
function layoutSpokes(studies: SunburstStudyNode[]): SpokeLayout[] {
  return studies.map((study, index) => ({
    study,
    angle: (index / studies.length) * 2 * Math.PI - Math.PI / 2
  }))
}

function labelAnchor(angle: number): 'start' | 'middle' | 'end' {
  const cos = Math.cos(angle)
  if (cos > 0.3) return 'start'
  if (cos < -0.3) return 'end'
  return 'middle'
}

function labelBaseline(angle: number): 'auto' | 'central' | 'hanging' {
  const sin = Math.sin(angle)
  if (sin > 0.3) return 'hanging'
  if (sin < -0.3) return 'auto'
  return 'central'
}

interface OpeningSunburstCenterProps {
  center: SunburstCenterData
  onEnterStudy: (studyId: string) => void
  onCreateStudy: (pieceType: OpeningPieceType) => void
}

function OpeningSunburstCenter({
  center,
  onEnterStudy,
  onCreateStudy
}: OpeningSunburstCenterProps): React.JSX.Element {
  const spokes = useMemo(() => layoutSpokes(center.studies), [center.studies])
  const pieceIcon = getPieceLabel({ kind: center.pieceType, side: 'red' })

  return (
    <div className="sunburst-center">
      <svg
        className="sunburst-canvas"
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${CENTER_X}, ${CENTER_Y})`}>
          {spokes.map(({ study, angle }) => {
            const cos = Math.cos(angle)
            const sin = Math.sin(angle)
            const startX = cos * HUB_RADIUS
            const startY = sin * HUB_RADIUS
            const ballX = cos * SPOKE_LENGTH
            const ballY = sin * SPOKE_LENGTH
            const labelX = cos * (SPOKE_LENGTH + BALL_RADIUS + LABEL_GAP)
            const labelY = sin * (SPOKE_LENGTH + BALL_RADIUS + LABEL_GAP)
            return (
              <g
                key={study.studyId}
                className="sunburst-spoke-group"
                onClick={() => onEnterStudy(study.studyId)}
                role="button"
                aria-label={`进入棋路：${study.title}`}
              >
                <line className="sunburst-spoke" x1={startX} y1={startY} x2={ballX} y2={ballY} />
                <circle className="sunburst-ball" cx={ballX} cy={ballY} r={BALL_RADIUS} />
                <text
                  className="sunburst-ball-label"
                  x={labelX}
                  y={labelY}
                  textAnchor={labelAnchor(angle)}
                  dominantBaseline={labelBaseline(angle)}
                >
                  {study.title}
                </text>
              </g>
            )
          })}
          <circle
            className="sunburst-hub"
            r={HUB_RADIUS}
            onClick={() => onCreateStudy(center.pieceType)}
            role="button"
            aria-label={`新建${center.centerLabel}`}
          />
          <text className="sunburst-hub-label" textAnchor="middle" dominantBaseline="central">
            {pieceIcon}
          </text>
        </g>
      </svg>
    </div>
  )
}

interface OpeningSunburstProps {
  center: SunburstCenterData
  onEnterStudy: (studyId: string) => void
  onCreateStudy: (pieceType: OpeningPieceType) => void
}

/**
 * 一次只显示一个开局的径向图。
 *
 * 之前是五个中心点并排挤在一屏里，每个只分到窗口五分之一的宽度，谱名一长就互相盖住、
 * 甚至被裁掉（用户反馈里的问题）。改成上面一排按钮切换、下面整屏画一个，空间一下就够了。
 */
export function OpeningSunburst({ center, onEnterStudy, onCreateStudy }: OpeningSunburstProps): React.JSX.Element {
  return (
    <div className="sunburst-single">
      <OpeningSunburstCenter center={center} onEnterStudy={onEnterStudy} onCreateStudy={onCreateStudy} />
    </div>
  )
}
