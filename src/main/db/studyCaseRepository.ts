// study_cases 表的增删改查（中局/终局案例）。结构和 openingStudyRepository 很像，
// 区别是案例有 folderId（可分类到文件夹）、初始局面通常是用户手动摆的局面而不是标准开局。

import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import type { StudyCase, StudyCaseType } from '@shared/moveTree'
import { MoveNodeRepository } from './moveNodeRepository'

interface StudyCaseRow {
  id: string
  type: StudyCaseType
  title: string
  folder_id: string | null
  root_node_id: string
  created_at: number
  updated_at: number
  setup_completed: number
}

export interface CreateStudyCaseInput {
  type: StudyCaseType
  title: string
  folderId?: string | null
  initialFEN: string
}

export class StudyCaseRepository {
  private readonly moveNodes: MoveNodeRepository

  constructor(private readonly db: DatabaseSync) {
    this.moveNodes = new MoveNodeRepository(db)
  }

  private toStudyCase(row: StudyCaseRow): StudyCase | null {
    const rootNode = this.moveNodes.getById(row.root_node_id)
    if (!rootNode) return null
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      folderId: row.folder_id,
      rootNode,
      setupCompleted: row.setup_completed === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  create(input: CreateStudyCaseInput): StudyCase {
    const rootNode = this.moveNodes.create({
      parentId: null,
      move: '',
      moveCoord: '',
      boardStateFEN: input.initialFEN
    })
    const id = randomUUID()
    const now = Date.now()
    const folderId = input.folderId ?? null
    // 整局从标准开局起手，没有摆局阶段；中局/残局要先在空棋盘上摆子
    const setupCompleted = input.type === 'fullgame'
    this.db
      .prepare(
        `INSERT INTO study_cases (id, type, title, folder_id, root_node_id, created_at, updated_at, setup_completed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.type, input.title, folderId, rootNode.id, now, now, setupCompleted ? 1 : 0)
    return {
      id,
      type: input.type,
      title: input.title,
      folderId,
      rootNode,
      setupCompleted,
      createdAt: now,
      updatedAt: now
    }
  }

  getById(id: string): StudyCase | null {
    const row = this.db.prepare('SELECT * FROM study_cases WHERE id = ?').get(id) as
      | StudyCaseRow
      | undefined
    return row ? this.toStudyCase(row) : null
  }

  listAll(): StudyCase[] {
    const rows = this.db
      .prepare('SELECT * FROM study_cases ORDER BY created_at ASC')
      .all() as unknown as StudyCaseRow[]
    return rows.map((row) => this.toStudyCase(row)).filter((c): c is StudyCase => c !== null)
  }

  /** folderId传null查未分类的案例 */
  listByFolder(folderId: string | null): StudyCase[] {
    const rows =
      folderId === null
        ? (this.db
            .prepare('SELECT * FROM study_cases WHERE folder_id IS NULL ORDER BY created_at ASC')
            .all() as unknown as StudyCaseRow[])
        : (this.db
            .prepare('SELECT * FROM study_cases WHERE folder_id = ? ORDER BY created_at ASC')
            .all(folderId) as unknown as StudyCaseRow[])
    return rows.map((row) => this.toStudyCase(row)).filter((c): c is StudyCase => c !== null)
  }

  /** 按标题模糊搜索，对应案例库列表页的"搜索"功能 */
  searchByTitle(keyword: string): StudyCase[] {
    const rows = this.db
      .prepare('SELECT * FROM study_cases WHERE title LIKE ? ORDER BY created_at ASC')
      .all(`%${keyword}%`) as unknown as StudyCaseRow[]
    return rows.map((row) => this.toStudyCase(row)).filter((c): c is StudyCase => c !== null)
  }

  rename(id: string, title: string): StudyCase | null {
    this.db
      .prepare('UPDATE study_cases SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, Date.now(), id)
    return this.getById(id)
  }

  moveToFolder(id: string, folderId: string | null): StudyCase | null {
    this.db
      .prepare('UPDATE study_cases SET folder_id = ?, updated_at = ? WHERE id = ?')
      .run(folderId, Date.now(), id)
    return this.getById(id)
  }

  /**
   * 保存摆局阶段的成果。boardStateFEN传null表示"只改阶段标记、局面不动"（重新摆局时用）。
   * 摆到一半点保存 -> setupCompleted传false，局面存下来但下次打开仍回摆局界面；
   * 点"开始打谱" -> 传true，从此进入打谱阶段。
   */
  saveSetup(id: string, boardStateFEN: string | null, setupCompleted: boolean): StudyCase | null {
    const existing = this.getById(id)
    if (!existing) return null
    if (boardStateFEN !== null) {
      this.moveNodes.updateBoardState(existing.rootNode.id, boardStateFEN)
    }
    this.db
      .prepare('UPDATE study_cases SET setup_completed = ?, updated_at = ? WHERE id = ?')
      .run(setupCompleted ? 1 : 0, Date.now(), id)
    return this.getById(id)
  }

  touchUpdatedAt(id: string): void {
    this.db.prepare('UPDATE study_cases SET updated_at = ? WHERE id = ?').run(Date.now(), id)
  }

  delete(id: string): void {
    const studyCase = this.getById(id)
    if (!studyCase) return
    this.db.prepare('DELETE FROM study_cases WHERE id = ?').run(id)
    this.moveNodes.deleteSubtree(studyCase.rootNode.id)
  }
}
