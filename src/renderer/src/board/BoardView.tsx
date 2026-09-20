// 纯展示 + 点击转发的棋盘组件：只管"画出棋盘、画出子、把点击的格子坐标报告出去"，
// 不知道也不关心规则引擎、当前是谁的回合——那些状态和逻辑都在 useXiangqiGame 里。
//
// 反转视角（flipped）只改"棋盘坐标画到屏幕哪个位置"，不动棋盘数据本身：
// 所有对外的 Position 依然是数据坐标，调用方不用管现在是正着看还是反着看。
// 棋盘的线、九宫、星位、河界在 180° 旋转下都是对称的，所以只有棋子、命中区
// 和两侧的路数需要跟着翻。

import { getPieceBoardLabel } from '@shared/chess'
import type { Board, Position } from '@shared/chess'
import grainTextureUrl from '../assets/grain-texture.png'
import { readPieceDragData, setPieceDragData, type PieceDragPayload } from '../study/dragTypes'
import { BOARD_HEIGHT, BOARD_MARGIN, BOARD_WIDTH, CELL_SIZE, COLS, ROWS, colToX, rowToY } from './boardLayout'

/** 摆局阶段专用：允许拖拽棋子到棋盘上/从棋盘上拖出/双击删除，不传这个prop就是普通对弈模式 */
export interface BoardPlacementHandlers {
  onDropPiece: (pos: Position, payload: PieceDragPayload) => void
  onRemovePiece: (pos: Position) => void
}

interface BoardViewProps {
  board: Board
  selected: Position | null
  legalTargets: Position[]
  onSquareClick?: (pos: Position) => void
  placement?: BoardPlacementHandlers
  /** true = 黑方在下、红方在上 */
  flipped?: boolean
}

function isSamePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col
}

function VerticalLines(): React.JSX.Element {
  const lines: React.JSX.Element[] = []
  for (let col = 0; col < COLS; col++) {
    const x = colToX(col)
    const isEdgeColumn = col === 0 || col === COLS - 1
    if (isEdgeColumn) {
      // 最左/最右两条边线贯穿全场，不受楚河汉界断开的影响
      lines.push(<line key={col} x1={x} y1={rowToY(0)} x2={x} y2={rowToY(ROWS - 1)} />)
    } else {
      // 中间的竖线在河界处断开（row4~row5之间），这是象棋棋盘的标志性画法
      lines.push(<line key={`${col}-top`} x1={x} y1={rowToY(0)} x2={x} y2={rowToY(4)} />)
      lines.push(<line key={`${col}-bottom`} x1={x} y1={rowToY(5)} x2={x} y2={rowToY(ROWS - 1)} />)
    }
  }
  return <g className="board-grid-lines">{lines}</g>
}

function HorizontalLines(): React.JSX.Element {
  const lines: React.JSX.Element[] = []
  for (let row = 0; row < ROWS; row++) {
    const y = rowToY(row)
    lines.push(<line key={row} x1={colToX(0)} y1={y} x2={colToX(COLS - 1)} y2={y} />)
  }
  return <g className="board-grid-lines">{lines}</g>
}

function PalaceDiagonals(): React.JSX.Element {
  // 九宫斜线：黑方在row0-2，红方在row7-9，都在col3-5之间
  return (
    <g className="board-palace-lines">
      <line x1={colToX(3)} y1={rowToY(0)} x2={colToX(5)} y2={rowToY(2)} />
      <line x1={colToX(5)} y1={rowToY(0)} x2={colToX(3)} y2={rowToY(2)} />
      <line x1={colToX(3)} y1={rowToY(7)} x2={colToX(5)} y2={rowToY(9)} />
      <line x1={colToX(5)} y1={rowToY(7)} x2={colToX(3)} y2={rowToY(9)} />
    </g>
  )
}

/** 星位：炮位（row2/row7 的 1、7 路）和卒林（row3/row6 每隔一列一个），实体棋盘上刻的那圈小拐角 */
const STAR_POINTS: Position[] = [
  ...[2, 7].flatMap((row) => [1, 7].map((col) => ({ row, col }))),
  ...[3, 6].flatMap((row) => [0, 2, 4, 6, 8].map((col) => ({ row, col })))
]

const STAR_GAP = 6 // 拐角离交叉点的距离
const STAR_ARM = 11 // 每条短边的长度

/**
 * 一个星位 = 交叉点四周四个"┌ ┐ └ ┘"小拐角。
 * 贴着棋盘左右边线的点（1路和9路）只画朝里的那两个，朝外那两个会跑到棋盘外面去。
 */
function StarPoint({ row, col }: Position): React.JSX.Element {
  const x = colToX(col)
  const y = rowToY(row)
  const corners: Array<{ dx: number; dy: number }> = []
  for (const dx of [-1, 1]) {
    if (dx === -1 && col === 0) continue
    if (dx === 1 && col === COLS - 1) continue
    for (const dy of [-1, 1]) corners.push({ dx, dy })
  }

  return (
    <>
      {corners.map(({ dx, dy }) => {
        const cx = x + dx * STAR_GAP
        const cy = y + dy * STAR_GAP
        return (
          <g key={`${dx}-${dy}`}>
            <line x1={cx} y1={cy} x2={cx + dx * STAR_ARM} y2={cy} />
            <line x1={cx} y1={cy} x2={cx} y2={cy + dy * STAR_ARM} />
          </g>
        )
      })}
    </>
  )
}

function StarPoints(): React.JSX.Element {
  return (
    <g className="board-star-points">
      {STAR_POINTS.map((pos) => (
        <StarPoint key={`${pos.row}-${pos.col}`} {...pos} />
      ))}
    </g>
  )
}

/** 棋子的雕刻感斜面（径向渐变）+ 棋盘表面的宣纸/木纹肌理（复用全局背景同一张生成图），
 * 两者都得放进SVG自己的<defs>里才能被.piece的CSS `fill: url(#pieceGradient)`和棋盘背景
 * 的<pattern>引用到——纯CSS做不到给SVG图形填充渐变/图片，只能在SVG里预先定义好。 */
function BoardDefs(): React.JSX.Element {
  return (
    <defs>
      <radialGradient id="pieceGradient" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#fbf1da" />
        <stop offset="65%" stopColor="#f0dfb8" />
        <stop offset="100%" stopColor="#d9c294" />
      </radialGradient>
      <pattern id="boardGrainPattern" patternUnits="userSpaceOnUse" width="220" height="220">
        <image href={grainTextureUrl} x={0} y={0} width={220} height={220} opacity={0.12} />
      </pattern>
    </defs>
  )
}

const BLACK_FILES = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const RED_FILES = ['九', '八', '七', '六', '五', '四', '三', '二', '一']

/**
 * 路数永远跟着自己那一方：黑方是阿拉伯数字 1-9，红方是汉字一-九，
 * 谁在屏幕下面就把谁的路数画在下面。反转之后两边的数字顺序也跟着倒过来，
 * 因为棋盘是整个转了 180°，原来在左边的那一路现在在右边。
 */
function FileCoordinates({ flipped }: { flipped: boolean }): React.JSX.Element {
  const topLabels = flipped ? [...RED_FILES].reverse() : BLACK_FILES
  const bottomLabels = flipped ? [...BLACK_FILES].reverse() : RED_FILES
  return (
    <g className="board-file-labels">
      {topLabels.map((label, col) => (
        <text key={`top-${col}`} x={colToX(col)} y={22} textAnchor="middle">
          {label}
        </text>
      ))}
      {bottomLabels.map((label, col) => (
        <text key={`bottom-${col}`} x={colToX(col)} y={BOARD_HEIGHT - 16} textAnchor="middle">
          {label}
        </text>
      ))}
    </g>
  )
}

function RiverLabel(): React.JSX.Element {
  const y = (rowToY(4) + rowToY(5)) / 2
  return (
    <g className="board-river-label">
      <text x={colToX(1.5)} y={y} dominantBaseline="middle" textAnchor="middle">
        楚 河
      </text>
      <text x={colToX(6.5)} y={y} dominantBaseline="middle" textAnchor="middle">
        汉 界
      </text>
    </g>
  )
}

export function BoardView({
  board,
  selected,
  legalTargets,
  onSquareClick,
  placement,
  flipped = false
}: BoardViewProps): React.JSX.Element {
  const toX = (col: number): number => colToX(flipped ? COLS - 1 - col : col)
  const toY = (row: number): number => rowToY(flipped ? ROWS - 1 - row : row)

  const intersections: React.JSX.Element[] = []

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const pos: Position = { row, col }
      const piece = board[row][col]
      const x = toX(col)
      const y = toY(row)
      const isSelected = selected !== null && isSamePosition(selected, pos)
      const isLegalTarget = legalTargets.some((target) => isSamePosition(target, pos))

      intersections.push(
        <g
          key={`${row}-${col}`}
          onClick={() => onSquareClick?.(pos)}
          onDragOver={placement ? (e) => e.preventDefault() : undefined}
          onDrop={
            placement
              ? (e) => {
                  e.preventDefault()
                  const payload = readPieceDragData(e)
                  if (payload) placement.onDropPiece(pos, payload)
                }
              : undefined
          }
          style={{ cursor: 'pointer' }}
        >
          {/* 透明的大命中区域，保证点空白格子也能触发点击，不用非要精准点在棋子上 */}
          <circle cx={x} cy={y} r={CELL_SIZE / 2 - 2} fill="transparent" />

          {isLegalTarget && !piece && <circle className="move-hint-dot" cx={x} cy={y} r={7} />}

          {piece && (
            <g
              // React的SVGProps类型定义里没有draggable（HTML5拖拽的draggable属性理论上通用，
              // 但SVG元素的TS类型没跟上），这里用类型断言强行加上去，浏览器实际是支持的。
              {...({ draggable: Boolean(placement) } as unknown as React.SVGAttributes<SVGGElement>)}
              onDragStart={
                placement ? (e) => setPieceDragData(e, { kind: piece.kind, side: piece.side, fromBoard: pos }) : undefined
              }
              onDoubleClick={placement ? () => placement.onRemovePiece(pos) : undefined}
            >
              {isLegalTarget && <circle className="capture-hint-ring" cx={x} cy={y} r={26} />}
              <circle
                className={`piece piece-${piece.side}${isSelected ? ' piece-selected' : ''}`}
                cx={x}
                cy={y}
                r={24}
              />
              <text className={`piece-label piece-label-${piece.side}`} x={x} y={y} dominantBaseline="central" textAnchor="middle">
                {getPieceBoardLabel(piece)}
              </text>
            </g>
          )}
        </g>
      )
    }
  }

  return (
    <div
      className="xiangqi-board-frame"
      style={{ '--board-w': BOARD_WIDTH, '--board-h': BOARD_HEIGHT } as React.CSSProperties}
    >
      <svg
        className="xiangqi-board"
        viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <BoardDefs />
        <rect x={0} y={0} width={BOARD_WIDTH} height={BOARD_HEIGHT} className="board-background" />
        <rect
          x={0}
          y={0}
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          className="board-grain-overlay"
          fill="url(#boardGrainPattern)"
        />
        <HorizontalLines />
        <VerticalLines />
        <PalaceDiagonals />
        <StarPoints />
        {/* 双线外框：外面一条粗、里面一条细，实体棋盘就是这么包边的。
            必须在棋子渲染之前画，否则会盖在棋子上面。 */}
        {[
          { inset: BOARD_MARGIN - 20, className: 'board-outer-border board-outer-border-thick' },
          { inset: BOARD_MARGIN - 12, className: 'board-outer-border' }
        ].map(({ inset, className }) => (
          <rect
            key={className}
            x={inset}
            y={inset}
            width={BOARD_WIDTH - inset * 2}
            height={BOARD_HEIGHT - inset * 2}
            className={className}
            fill="none"
          />
        ))}
        <RiverLabel />
        <FileCoordinates flipped={flipped} />
        {intersections}
      </svg>
    </div>
  )
}
