// 纯展示 + 点击转发的棋盘组件：只管"画出棋盘、画出子、把点击的格子坐标报告出去"，
// 不知道也不关心规则引擎、当前是谁的回合——那些状态和逻辑都在 useXiangqiGame 里。

import { getPieceLabel } from '@shared/chess'
import type { Board, Position } from '@shared/chess'
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

export function BoardView({ board, selected, legalTargets, onSquareClick, placement }: BoardViewProps): React.JSX.Element {
  const intersections: React.JSX.Element[] = []

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const pos: Position = { row, col }
      const piece = board[row][col]
      const x = colToX(col)
      const y = rowToY(row)
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
                {getPieceLabel(piece)}
              </text>
            </g>
          )}
        </g>
      )
    }
  }

  return (
    <svg
      className="xiangqi-board"
      width={BOARD_WIDTH}
      height={BOARD_HEIGHT}
      viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
    >
      <rect x={0} y={0} width={BOARD_WIDTH} height={BOARD_HEIGHT} className="board-background" />
      <HorizontalLines />
      <VerticalLines />
      <PalaceDiagonals />
      {/* 边框线的位置正好贴着最外圈棋子的边缘，必须在棋子渲染之前画，
          否则会盖在棋子上面（这条线之前被错误地放在了{intersections}后面）。 */}
      <rect
        x={BOARD_MARGIN - 2}
        y={BOARD_MARGIN - 2}
        width={BOARD_WIDTH - (BOARD_MARGIN - 2) * 2}
        height={BOARD_HEIGHT - (BOARD_MARGIN - 2) * 2}
        className="board-outer-border"
        fill="none"
      />
      <RiverLabel />
      {intersections}
    </svg>
  )
}
