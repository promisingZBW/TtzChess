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
    this.db
      .prepare(
        `INSERT INTO study_cases (id, type, title, folder_id, root_node_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.type, input.title, folderId, rootNode.id, now, now)
    return { id, type: input.type, title: input.title, folderId, rootNode, createdAt: now, updatedAt: now }
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

  delete(id: string): void {
    const studyCase = this.getById(id)
    if (!studyCase) return
    this.db.prepare('DELETE FROM study_cases WHERE id = ?').run(id)
    this.moveNodes.deleteSubtree(studyCase.rootNode.id)
  }
}
