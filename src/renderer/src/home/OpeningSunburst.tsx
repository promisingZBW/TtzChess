// 开局径向图（dev guide 4.1/9节）：多个中心点并列展示，一个中心点=一种起手棋子类型。
// 每个中心点用 d3.hierarchy + d3.partition 做真正的径向分区布局——半径方向是棋谱树的深度
// （第几步），角度方向按分支数量自动平分，这就是"深度=半径、分支数量=角度分布"的具体实现。
//
// 点击行为区分（dev guide 3.2/4.1节）：
// - 点击中心点本身（圆心那颗棋子图标）-> 创建新棋路（弹窗输入谱名）
// - 点击已经展开出来的任意一段扇区（不管是第一层的"棋路本身"还是更深的某一步棋）
//   -> 直接进入对应的 OpeningStudy，不弹窗

import { useMemo } from 'react'
import { arc as d3Arc, hierarchy, partition } from 'd3'
import type { HierarchyRectangularNode } from 'd3'
import type { OpeningPieceType } from '@shared/moveTree'
import { getPieceLabel } from '@shared/chess'
import type { SunburstCenterData, SunburstSegment } from './openingSunburstUtils'

const OUTER_RADIUS = 120
const HUB_RADIUS = 26

interface HierarchyDatum {
  label: string
  studyId: string | null
  children: HierarchyDatum[]
}

function toHierarchyDatum(segment: SunburstSegment): HierarchyDatum {
  return { label: segment.label, studyId: segment.studyId, children: segment.children.map(toHierarchyDatum) }
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
  const arcs = useMemo(() => {
    const data: HierarchyDatum = {
      label: center.centerLabel,
      studyId: null,
      children: center.segments.map(toHierarchyDatum)
    }
    const root = hierarchy(data, (d) => d.children).sum((d) => (d.children.length === 0 ? 1 : 0))
    const positioned = partition<HierarchyDatum>().size([2 * Math.PI, OUTER_RADIUS - HUB_RADIUS])(root)
    // depth 0 是虚拟的"中心点"本身，不是真正的棋路数据，单独用一个圆表示，不参与扇区渲染
    return positioned.descendants().filter((d) => d.depth > 0)
  }, [center])

  const arcGenerator = useMemo(
    () =>
      d3Arc<HierarchyRectangularNode<HierarchyDatum>>()
        .startAngle((d) => d.x0)
        .endAngle((d) => d.x1)
        .padAngle(0.006)
        .padRadius(HUB_RADIUS)
        .innerRadius((d) => HUB_RADIUS + d.y0)
        .outerRadius((d) => HUB_RADIUS + d.y1 - 1),
    []
  )

  const pieceIcon = getPieceLabel({ kind: center.pieceType, side: 'red' })

  return (
    <div className="sunburst-center">
      <svg width={OUTER_RADIUS * 2} height={OUTER_RADIUS * 2} viewBox={`0 0 ${OUTER_RADIUS * 2} ${OUTER_RADIUS * 2}`}>
        <g transform={`translate(${OUTER_RADIUS}, ${OUTER_RADIUS})`}>
          {arcs.map((d, index) => (
            <path
              key={index}
              className={`sunburst-arc sunburst-arc-depth-${Math.min(d.depth, 4)}`}
              d={arcGenerator(d) ?? undefined}
              onClick={() => d.data.studyId && onEnterStudy(d.data.studyId)}
            >
              <title>{d.data.label || '起始局面'}</title>
            </path>
          ))}
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
      <p className="sunburst-center-caption">{center.centerLabel}</p>
    </div>
  )
}

interface OpeningSunburstProps {
  centers: SunburstCenterData[]
  onEnterStudy: (studyId: string) => void
  onCreateStudy: (pieceType: OpeningPieceType) => void
}

export function OpeningSunburst({ centers, onEnterStudy, onCreateStudy }: OpeningSunburstProps): React.JSX.Element {
  return (
    <div className="sunburst-row">
      {centers.map((center) => (
        <OpeningSunburstCenter
          key={center.pieceType}
          center={center}
          onEnterStudy={onEnterStudy}
          onCreateStudy={onCreateStudy}
        />
      ))}
    </div>
  )
}
