// UCCI/引擎坐标记法：文件字母 a-i（对应 col 0-8，从棋盘左边到右边，和FEN每行列顺序一致）+
// 行号 0-9（对应 row 9-0，即红方底线是0、黑方底线是9，这是UCCI协议的行号约定）。
//
// 这套记法和 notation.ts 的"中文纵线记谱法"是两回事：中文记谱是给人看的、红黑双方视角不同；
// UCCI坐标是给引擎/程序用的（MoveNode.moveCoord字段、以后阶段6接入Pikafish都要用这个），
// 红黑双方共用同一套坐标系，不需要区分视角。
//
// 验证过一个例子：红方开局"炮二平五"，右炮从(row7,col7)走到(row7,col4)，
// 按下面的换算得到 "h2e2"，和 dev guide 里 MoveNode.moveCoord 字段的示例完全一致。

import type { Move, Position } from './types'

export function positionToUcciSquare(pos: Position): string {
  const file = String.fromCharCode('a'.charCodeAt(0) + pos.col)
  const rank = 9 - pos.row
  return `${file}${rank}`
}

export function moveToUcciCoord(move: Move): string {
  return positionToUcciSquare(move.from) + positionToUcciSquare(move.to)
}
