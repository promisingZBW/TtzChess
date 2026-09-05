// 老数据库文件的字段补丁。schema.ts 里的 `CREATE TABLE IF NOT EXISTS` 只对全新的库生效，
// 已经存在的表不会因为 schema 改了就自动多出一列——用户电脑上的 data/ttzchess.sqlite3 是
// 上一个版本创建的，所以每次打开连接之后还要跑一遍这里的补丁。
//
// 写法约定：每个补丁都必须可以重复执行（先探测再改），因为每次启动程序都会调用一次。

import type { DatabaseSync } from 'node:sqlite'
import { EMPTY_BOARD_FEN } from '@shared/chess'

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.some((row) => row.name === column)
}

/**
 * study_cases.setup_completed：中局/残局案例"摆局阶段有没有结束"。
 *
 * 加这一列之前，是靠"根节点局面还是空棋盘、而且一步棋都没走"来反推还在摆局阶段的。
 * 这个推断有个致命副作用：摆局阶段点"保存"根本没法把摆好的子存进根节点——一存进去，
 * 下次打开就被判成"摆局已结束"，再也回不到摆局界面。于是当时干脆没存，用户摆了半天的
 * 局面只活在内存里，关掉程序就没了（正是用户反馈的"保存好的谱下次没法编辑"）。
 * 有了这个显式标记，局面和"阶段"就解耦了，摆到一半也能存。
 */
function addStudyCaseSetupCompleted(db: DatabaseSync): void {
  if (hasColumn(db, 'study_cases', 'setup_completed')) return

  db.exec('ALTER TABLE study_cases ADD COLUMN setup_completed INTEGER NOT NULL DEFAULT 0')

  // 老数据回填：整局案例从来就没有摆局阶段；中局/残局只要根节点局面已经不是空棋盘、
  // 或者底下已经记了走法，就说明当年是点过"开始打谱"的，一律算摆局已结束。
  db.prepare(
    `UPDATE study_cases SET setup_completed = 1
     WHERE type = 'fullgame'
        OR root_node_id IN (SELECT id FROM move_nodes WHERE board_state_fen <> ?)
        OR root_node_id IN (SELECT parent_id FROM move_nodes WHERE parent_id IS NOT NULL)`
  ).run(EMPTY_BOARD_FEN)
}

export function runMigrations(db: DatabaseSync): void {
  addStudyCaseSetupCompleted(db)
}
