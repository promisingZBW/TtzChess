// 纯数据变换：把"按棋子类型分组的棋路列表"组装成径向图需要的结构。不涉及任何UI/IPC/d3，
// 方便单独写单元测试。
//
// 结构说明（对应用户反馈后的修正版设计）：
// 中心点(SunburstCenterData，一种起手棋子类型) -> 从中心延伸出去的每一条独立命名的棋路
// (SunburstStudyNode，渲染成"一根线+一个可点击小球")。棋路之间彼此独立，互不嵌套——
// 一条棋路内部即使有很多步、很多分支，径向图上也只表现为一个球；要看具体走法，
// 得点进这个球，进入阶段4做好的打谱详情界面。所以这里完全不需要棋谱树数据，
// 只需要每条棋路的id和谱名。

import type { OpeningPieceType, OpeningRoot } from '@shared/moveTree'

// 和 src/main/db/openingStudyRepository.ts 里的 CENTER_LABELS 保持一致
export const OPENING_CENTER_LABELS: Record<OpeningPieceType, string> = {
  N: '起马局',
  B: '飞象局',
  C: '当头炮局',
  R: '直车局',
  P: '挺兵局'
}

export const ALL_OPENING_PIECE_TYPES: OpeningPieceType[] = ['C', 'N', 'R', 'B', 'P']

/**
 * `listOpeningRoots` 只会返回"已经至少创建过一条棋路"的起手棋子类型；但径向图首页要求
 * 5个中心点（车马炮象兵）一直都在，哪怕还没创建过棋路，用户也要能点中心点创建第一条——
 * 这个函数把缺失的类型补成一个"studyIds为空"的占位 OpeningRoot。
 */
export function ensureAllPieceTypeRoots(roots: OpeningRoot[]): OpeningRoot[] {
  const byType = new Map(roots.map((r) => [r.pieceType, r] as const))
  return ALL_OPENING_PIECE_TYPES.map(
    (pieceType) => byType.get(pieceType) ?? { pieceType, centerLabel: OPENING_CENTER_LABELS[pieceType], studyIds: [] }
  )
}

/** 径向图上从中心延伸出去的一条棋路：一根线+一个小球，球上标着谱名 */
export interface SunburstStudyNode {
  studyId: string
  title: string
}

export interface SunburstCenterData {
  pieceType: OpeningPieceType
  centerLabel: string
  /** 该中心点下用户自己创建的每一条独立棋路，顺序即创建顺序 */
  studies: SunburstStudyNode[]
}

/**
 * 组装径向图首页需要的全部数据：按 OpeningRoot（起手棋子类型分组）逐个展开成中心点，
 * 每个中心点下挂着它名下所有棋路的id+谱名。studyTitles里查不到的studyId会被跳过
 * （比如数据刚好在两次查询之间被删除），不影响其它棋路正常渲染。
 */
export function buildSunburstCenters(roots: OpeningRoot[], studyTitles: Map<string, string>): SunburstCenterData[] {
  return roots.map((root) => ({
    pieceType: root.pieceType,
    centerLabel: root.centerLabel,
    studies: root.studyIds
      .filter((studyId) => studyTitles.has(studyId))
      .map((studyId) => ({ studyId, title: studyTitles.get(studyId) as string }))
  }))
}
