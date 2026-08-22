// 纯数据变换：把"按棋子类型分组的棋路列表"+"每条棋路的完整棋谱树"，组装成d3.partition()
// 径向布局需要的嵌套结构。不涉及任何UI/IPC/d3本身，方便单独写单元测试。
//
// 结构说明（对应 dev guide 3.2/4.1 节）：
// 中心点(SunburstCenterData，一种起手棋子类型) -> 顶层扇区(每条独立命名的OpeningStudy)
// -> 更深的扇区(棋谱树里的每一步棋，支持分支)。点击行为上，dev guide只要求"点击已有棋路的
// 任意分支线段都直接进入该棋路"，不要求精确定位到点的是哪一步，所以每个扇区只需要携带
// studyId这一个字段，供点击时"进入哪条棋路"使用，不需要区分"点的是第几层"。

import type { MoveNode, OpeningPieceType, OpeningRoot } from '@shared/moveTree'

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

export interface SunburstStudyData {
  studyId: string
  title: string
  rootNodeId: string
  nodes: Map<string, MoveNode>
}

export interface SunburstSegment {
  id: string
  studyId: string
  label: string
  children: SunburstSegment[]
}

export interface SunburstCenterData {
  pieceType: OpeningPieceType
  centerLabel: string
  /** 顶层的每一个元素代表该中心点下的一条独立命名棋路（OpeningStudy） */
  segments: SunburstSegment[]
}

function buildMoveSegments(nodes: Map<string, MoveNode>, nodeId: string, studyId: string): SunburstSegment | null {
  const node = nodes.get(nodeId)
  if (!node) return null // 数据异常兜底：棋谱树缓存里缺了这个节点就不渲染它，不让整个径向图崩掉
  return {
    id: node.id,
    studyId,
    label: node.move || '',
    children: node.childrenIds
      .map((childId) => buildMoveSegments(nodes, childId, studyId))
      .filter((s): s is SunburstSegment => s !== null)
  }
}

/**
 * 把某条棋路的棋谱树转换成一个顶层扇区：扇区本身代表这条棋路（label=谱名），
 * 它的直接子扇区是根节点（起始局面，不需要单独占一层）的每一个第一步走法。
 */
function buildStudySegment(study: SunburstStudyData): SunburstSegment {
  const rootNode = study.nodes.get(study.rootNodeId)
  const firstMoveIds = rootNode?.childrenIds ?? []
  return {
    id: study.studyId,
    studyId: study.studyId,
    label: study.title,
    children: firstMoveIds
      .map((childId) => buildMoveSegments(study.nodes, childId, study.studyId))
      .filter((s): s is SunburstSegment => s !== null)
  }
}

/**
 * 组装径向图首页需要的全部数据：按 OpeningRoot（起手棋子类型分组）逐个展开成中心点，
 * 每个中心点下挂着它名下所有棋路各自的完整棋谱树。studies里查不到的studyId会被跳过
 * （比如数据刚好在两次查询之间被删除），不影响其它棋路正常渲染。
 */
export function buildSunburstCenters(
  roots: OpeningRoot[],
  studies: Map<string, SunburstStudyData>
): SunburstCenterData[] {
  return roots.map((root) => ({
    pieceType: root.pieceType,
    centerLabel: root.centerLabel,
    segments: root.studyIds
      .map((studyId) => studies.get(studyId))
      .filter((s): s is SunburstStudyData => s !== undefined)
      .map(buildStudySegment)
  }))
}
