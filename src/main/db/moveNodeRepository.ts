// move_nodes 表的增删改查，以及阶段3要求的"给定节点id，取出从根到该节点的完整路径"查询。
// 这是棋谱树最底层的数据访问层，OpeningStudy/StudyCase 的仓库都依赖这里管理各自的根节点和子树。

import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import type { MoveNode } from '@shared/moveTree'

interface MoveNodeRow {
  id: string
  parent_id: string | null
  move: string
  move_coord: string
  board_state_fen: string
  note: string | null
  has_note: number
  created_at: number
}

export interface CreateMoveNodeInput {
  parentId: string | null
  move: string
  moveCoord: string
  boardStateFEN: string
  note?: string | null
}

export class MoveNodeRepository {
  constructor(private readonly db: DatabaseSync) {}

  private getChildrenIds(nodeId: string): string[] {
    const rows = this.db
      .prepare('SELECT id FROM move_nodes WHERE parent_id = ? ORDER BY created_at ASC')
      .all(nodeId) as Array<{ id: string }>
    return rows.map((row) => row.id)
  }

  private toMoveNode(row: MoveNodeRow): MoveNode {
    return {
      id: row.id,
      parentId: row.parent_id,
      childrenIds: this.getChildrenIds(row.id),
      move: row.move,
      moveCoord: row.move_coord,
      boardStateFEN: row.board_state_fen,
      note: row.note,
      hasNote: row.has_note === 1,
      createdAt: row.created_at
    }
  }

  create(input: CreateMoveNodeInput): MoveNode {
    const id = randomUUID()
    const createdAt = Date.now()
    const note = input.note ?? null
    this.db
      .prepare(
        `INSERT INTO move_nodes (id, parent_id, move, move_coord, board_state_fen, note, has_note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.parentId,
        input.move,
        input.moveCoord,
        input.boardStateFEN,
        note,
        note !== null ? 1 : 0,
        createdAt
      )
    return {
      id,
      parentId: input.parentId,
      childrenIds: [],
      move: input.move,
      moveCoord: input.moveCoord,
      boardStateFEN: input.boardStateFEN,
      note,
      hasNote: note !== null,
      createdAt
    }
  }

  getById(id: string): MoveNode | null {
    const row = this.db.prepare('SELECT * FROM move_nodes WHERE id = ?').get(id) as
      | MoveNodeRow
      | undefined
    return row ? this.toMoveNode(row) : null
  }

  /** 设置/清空一个节点的笔记；note传null或空字符串时，hasNote会同步变回false */
  setNote(id: string, note: string | null): MoveNode | null {
    const normalized = note && note.length > 0 ? note : null
    this.db
      .prepare('UPDATE move_nodes SET note = ?, has_note = ? WHERE id = ?')
      .run(normalized, normalized !== null ? 1 : 0, id)
    return this.getById(id)
  }

  /**
   * 阶段3要求的基础查询：给定一个节点id，取出从根到该节点的完整路径（数组顺序：根节点在前，目标节点在后）。
   * 前进/后退、光球跳转到某个历史局面时，都需要这条路径来知道"棋盘要重放哪些步骤"。
   */
  getPathFromRoot(nodeId: string): MoveNode[] {
    const path: MoveNode[] = []
    let currentId: string | null = nodeId
    const visited = new Set<string>()
    while (currentId !== null) {
      if (visited.has(currentId)) {
        throw new Error(`棋谱树数据异常：父子关系里检测到环（节点id: ${currentId}）`)
      }
      visited.add(currentId)
      const node: MoveNode | null = this.getById(currentId)
      if (!node) break
      path.push(node)
      currentId = node.parentId
    }
    return path.reverse()
  }

  /**
   * 从某个根节点开始，把整棵子树都加载出来，返回 "节点id -> MoveNode" 的映射。
   * 这就是重启程序后用来复原完整棋谱树的方法：拿到这个map，就能通过每个节点的
   * parentId/childrenIds 在内存里重建出完整的树形结构。
   */
  loadSubtree(rootId: string): Map<string, MoveNode> {
    const result = new Map<string, MoveNode>()
    const queue: string[] = [rootId]
    while (queue.length > 0) {
      const currentId = queue.shift() as string
      if (result.has(currentId)) continue
      const node = this.getById(currentId)
      if (!node) continue
      result.set(currentId, node)
      queue.push(...node.childrenIds)
    }
    return result
  }

  /** 删除一个节点及其整棵子树（依赖表结构里 parent_id 的 ON DELETE CASCADE 自动级联） */
  deleteSubtree(rootId: string): void {
    this.db.prepare('DELETE FROM move_nodes WHERE id = ?').run(rootId)
  }
}
