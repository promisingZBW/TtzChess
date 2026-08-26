// 棋谱树相关的核心数据结构，对应 xiangqi_app_dev_guide.md 第3节的类型定义。
// main 进程（SQLite读写）和 renderer 进程（棋盘UI、光球树、径向图）都从这里导入，
// 保证"数据库里存的"和"界面上用的"是同一套字段命名。

/** 棋谱树的一个节点：一步棋 + 走完这步之后的局面 */
export interface MoveNode {
  id: string
  parentId: string | null
  childrenIds: string[]
  move: string
  moveCoord: string
  boardStateFEN: string
  note: string | null
  hasNote: boolean
  createdAt: number
}

/** 开局径向图的中心点，按起手棋子类型区分 */
export type OpeningPieceType = 'N' | 'B' | 'C' | 'R' | 'P'

/** 某个中心点下汇总出的所有已创建棋路，供径向图渲染分组用（不是数据库表，是查询时聚合出来的） */
export interface OpeningRoot {
  pieceType: OpeningPieceType
  centerLabel: string
  studyIds: string[]
}

/** 一条独立命名的开局棋路研究 */
export interface OpeningStudy {
  id: string
  pieceType: OpeningPieceType
  title: string
  rootNode: MoveNode
  createdAt: number
  updatedAt: number
}

export type StudyCaseType = 'midgame' | 'endgame' | 'fullgame'

/** 中局/终局案例 */
export interface StudyCase {
  id: string
  type: StudyCaseType
  title: string
  folderId: string | null
  rootNode: MoveNode
  createdAt: number
  updatedAt: number
}

/** 案例库里用来分类管理的文件夹，支持嵌套 */
export interface Folder {
  id: string
  name: string
  parentFolderId: string | null
}
