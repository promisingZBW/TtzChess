// 棋盘的几何参数：格子大小、边距，以及"棋盘坐标(row,col) -> 屏幕像素坐标(x,y)"的换算。
// 单独拆出来是因为 BoardView 画线、画子、算点击命中都要用同一套坐标系，避免各处各写一份数字。

export const CELL_SIZE = 60
/** 要比棋子半径（24）再多留一截，路数文字才能画在棋子圆外面，不会被挡住 */
export const BOARD_MARGIN = 72
export const COLS = 9
export const ROWS = 10

export const BOARD_WIDTH = BOARD_MARGIN * 2 + (COLS - 1) * CELL_SIZE
export const BOARD_HEIGHT = BOARD_MARGIN * 2 + (ROWS - 1) * CELL_SIZE

export function colToX(col: number): number {
  return BOARD_MARGIN + col * CELL_SIZE
}

export function rowToY(row: number): number {
  return BOARD_MARGIN + row * CELL_SIZE
}
