// 纯展示 + 点击转发的棋盘组件：只管"画出棋盘、画出子、把点击的格子坐标报告出去"，
// 不知道也不关心规则引擎、当前是谁的回合——那些状态和逻辑都在 useXiangqiGame 里。

import { getPieceLabel } from '@shared/chess'
import type { Board, Position } from '@shared/chess'
import { BOARD_HEIGHT, BOARD_MARGIN, BOARD_WIDTH, CELL_SIZE, COLS, ROWS, colToX, rowToY } from './boardLayout'

interface BoardViewProps {
  board: Board
  selected: Position | null
  legalTargets: Position[]
  onSquareClick: (pos: Position) => void
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

export function BoardView({ board, selected, legalTargets, onSquareClick }: BoardViewProps): React.JSX.Element {
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
        <g key={`${row}-${col}`} onClick={() => onSquareClick(pos)} style={{ cursor: 'pointer' }}>
          {/* 透明的大命中区域，保证点空白格子也能触发点击，不用非要精准点在棋子上 */}
          <circle cx={x} cy={y} r={CELL_SIZE / 2 - 2} fill="transparent" />

          {isLegalTarget && !piece && <circle className="move-hint-dot" cx={x} cy={y} r={7} />}

          {piece && (
            <g>
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
