// 数据库表结构。用 `CREATE TABLE IF NOT EXISTS` 而不是迁移框架，
// 是因为目前只有"从零创建"这一种场景；等以后字段需要变更，再引入迁移脚本机制。
//
// 设计要点：
// - move_nodes.parent_id 自引用，并且设置了 ON DELETE CASCADE：删除一个节点时，
//   SQLite 会自动把它底下的整棵子树一起删掉，不用在应用层手写递归删除。
// - MoveNode.childrenIds 不作为一个字段存储（SQLite没有数组类型，硬存成JSON字符串
//   容易和真实的父子关系脱节），而是每次读取时用 `WHERE parent_id = ?` 现查，
//   保证"子节点列表"永远和实际的父子关系一致，不会出现两边数据对不上的情况。
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS move_nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES move_nodes(id) ON DELETE CASCADE,
  move TEXT NOT NULL,
  move_coord TEXT NOT NULL,
  board_state_fen TEXT NOT NULL,
  note TEXT,
  has_note INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_move_nodes_parent_id ON move_nodes (parent_id);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS opening_studies (
  id TEXT PRIMARY KEY,
  piece_type TEXT NOT NULL,
  title TEXT NOT NULL,
  root_node_id TEXT NOT NULL REFERENCES move_nodes(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opening_studies_piece_type ON opening_studies (piece_type);

CREATE TABLE IF NOT EXISTS study_cases (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  root_node_id TEXT NOT NULL REFERENCES move_nodes(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  setup_completed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_study_cases_folder_id ON study_cases (folder_id);
`
