// folders 表的增删改查，支持嵌套（parentFolderId）。

import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import type { Folder } from '@shared/moveTree'

interface FolderRow {
  id: string
  name: string
  parent_folder_id: string | null
}

export class FolderRepository {
  constructor(private readonly db: DatabaseSync) {}

  private toFolder(row: FolderRow): Folder {
    return { id: row.id, name: row.name, parentFolderId: row.parent_folder_id }
  }

  create(name: string, parentFolderId: string | null = null): Folder {
    const id = randomUUID()
    this.db
      .prepare('INSERT INTO folders (id, name, parent_folder_id) VALUES (?, ?, ?)')
      .run(id, name, parentFolderId)
    return { id, name, parentFolderId }
  }

  getById(id: string): Folder | null {
    const row = this.db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as
      | FolderRow
      | undefined
    return row ? this.toFolder(row) : null
  }

  /** parentFolderId传null查顶层文件夹 */
  listChildren(parentFolderId: string | null): Folder[] {
    const rows =
      parentFolderId === null
        ? (this.db.prepare('SELECT * FROM folders WHERE parent_folder_id IS NULL').all() as unknown as FolderRow[])
        : (this.db
            .prepare('SELECT * FROM folders WHERE parent_folder_id = ?')
            .all(parentFolderId) as unknown as FolderRow[])
    return rows.map((row) => this.toFolder(row))
  }

  rename(id: string, name: string): Folder | null {
    this.db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id)
    return this.getById(id)
  }

  /**
   * 删除一个文件夹本身。里面的子文件夹（ON DELETE SET NULL）会变成顶层文件夹，
   * 里面的案例（ON DELETE SET NULL）会变成"未分类"，不会被连带删除——
   * 删文件夹这个操作要不要连带删内容，属于需要产品决策的点（类似光球"删除节点"那个TODO），
   * 目前先按"最不容易丢用户数据"的方式处理。
   */
  delete(id: string): void {
    this.db.prepare('DELETE FROM folders WHERE id = ?').run(id)
  }
}
