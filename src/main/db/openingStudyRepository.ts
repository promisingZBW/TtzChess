// opening_studies 表的增删改查。每条 OpeningStudy 的棋谱树本身存在 move_nodes 表里，
// 这里只维护"这条棋路叫什么名字、属于哪个起手棋子类型、根节点是哪个"这些元信息。

import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import type { OpeningPieceType, OpeningRoot, OpeningStudy } from '@shared/moveTree'
import { MoveNodeRepository } from './moveNodeRepository'

interface OpeningStudyRow {
  id: string
  piece_type: OpeningPieceType
  title: string
  root_node_id: string
  created_at: number
  updated_at: number
}

// 径向图中心点的显示名，参考 dev guide 里"起马局""飞象局"的举例补全。
// 这套命名后面产品打磨阶段随时可以改，不影响数据结构。
const CENTER_LABELS: Record<OpeningPieceType, string> = {
  N: '起马局',
  B: '飞象局',
  C: '当头炮局',
  R: '直车局',
  P: '挺兵局'
}

export interface CreateOpeningStudyInput {
  pieceType: OpeningPieceType
  title: string
  initialFEN: string
}

export class OpeningStudyRepository {
  private readonly moveNodes: MoveNodeRepository

  constructor(private readonly db: DatabaseSync) {
    this.moveNodes = new MoveNodeRepository(db)
  }

  private toOpeningStudy(row: OpeningStudyRow): OpeningStudy | null {
    const rootNode = this.moveNodes.getById(row.root_node_id)
    if (!rootNode) return null // 理论上不会发生（根节点被意外删掉了），保守起见按"这条棋路不可用"处理
    return {
      id: row.id,
      pieceType: row.piece_type,
      title: row.title,
      rootNode,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  /** 创建一条新棋路：自动生成一个"标准开局起始局面"的根节点，棋谱树从空开始 */
  create(input: CreateOpeningStudyInput): OpeningStudy {
    const rootNode = this.moveNodes.create({
      parentId: null,
      move: '',
      moveCoord: '',
      boardStateFEN: input.initialFEN
    })
    const id = randomUUID()
    const now = Date.now()
    this.db
      .prepare(
        `INSERT INTO opening_studies (id, piece_type, title, root_node_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.pieceType, input.title, rootNode.id, now, now)
    return { id, pieceType: input.pieceType, title: input.title, rootNode, createdAt: now, updatedAt: now }
  }

  getById(id: string): OpeningStudy | null {
    const row = this.db.prepare('SELECT * FROM opening_studies WHERE id = ?').get(id) as
      | OpeningStudyRow
      | undefined
    return row ? this.toOpeningStudy(row) : null
  }

  listAll(): OpeningStudy[] {
    const rows = this.db
      .prepare('SELECT * FROM opening_studies ORDER BY created_at ASC')
      .all() as unknown as OpeningStudyRow[]
    return rows.map((row) => this.toOpeningStudy(row)).filter((s): s is OpeningStudy => s !== null)
  }

  listByPieceType(pieceType: OpeningPieceType): OpeningStudy[] {
    const rows = this.db
      .prepare('SELECT * FROM opening_studies WHERE piece_type = ? ORDER BY created_at ASC')
      .all(pieceType) as unknown as OpeningStudyRow[]
    return rows.map((row) => this.toOpeningStudy(row)).filter((s): s is OpeningStudy => s !== null)
  }

  /** 按棋子类型分组，拼成径向图首页要用的 OpeningRoot 列表（这是查询时聚合出来的，不是独立的表） */
  listOpeningRoots(): OpeningRoot[] {
    const grouped = new Map<OpeningPieceType, string[]>()
    for (const study of this.listAll()) {
      const studyIds = grouped.get(study.pieceType) ?? []
      studyIds.push(study.id)
      grouped.set(study.pieceType, studyIds)
    }
    return Array.from(grouped.entries()).map(([pieceType, studyIds]) => ({
      pieceType,
      centerLabel: CENTER_LABELS[pieceType],
      studyIds
    }))
  }

  rename(id: string, title: string): OpeningStudy | null {
    this.db
      .prepare('UPDATE opening_studies SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, Date.now(), id)
    return this.getById(id)
  }

  touchUpdatedAt(id: string): void {
    this.db.prepare('UPDATE opening_studies SET updated_at = ? WHERE id = ?').run(Date.now(), id)
  }

  /** 删除这条棋路，连带把它整棵棋谱树也删掉 */
  delete(id: string): void {
    const study = this.getById(id)
    if (!study) return
    this.db.prepare('DELETE FROM opening_studies WHERE id = ?').run(id)
    this.moveNodes.deleteSubtree(study.rootNode.id)
  }
}
