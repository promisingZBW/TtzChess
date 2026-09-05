// 回归测试：用户反馈"我编辑好棋谱保存好，下一次想修改编辑这个谱，没法编辑"。
//
// 原来的毛病：中局/残局案例的摆局阶段是靠"根节点局面还是空棋盘 && 一步棋都没走"反推出来的，
// 于是摆局阶段的"保存"根本不敢把摆好的子写进根节点（一写下次就被判成摆局已结束）。
// 结果就是摆了半天的局面只活在内存里，关掉程序全没了，下次打开还是一张空棋盘。
//
// 修好之后：摆局阶段用 study_cases.setup_completed 显式记录，局面和阶段解耦，摆到一半也能存。

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_BOARD_FEN, STANDARD_START_FEN } from '@shared/chess'
import { createChessDatabase, type ChessDatabase } from '../index'

let tempDir: string
let dbFilePath: string

const HALF_PLACED_FEN = '4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1'
const FULLY_PLACED_FEN = '4k4/9/9/9/9/R8/9/9/9/4K4 w - - 0 1'

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'chessoc-setup-test-'))
  dbFilePath = join(tempDir, 'chessoc.sqlite3')
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('中局/残局案例的摆局阶段', () => {
  it('摆到一半点保存，关掉程序再打开：局面还在，而且仍然回到摆局阶段', () => {
    let db: ChessDatabase = createChessDatabase(dbFilePath)
    const created = db.studyCases.create({
      type: 'endgame',
      title: '车兵例胜',
      initialFEN: EMPTY_BOARD_FEN
    })
    expect(created.setupCompleted).toBe(false)

    // 摆了两个王就点保存（还没点"开始打谱"）
    db.studyCases.saveSetup(created.id, HALF_PLACED_FEN, false)
    db.close()

    // ---------- 重启程序 ----------
    db = createChessDatabase(dbFilePath)
    const reopened = db.studyCases.getById(created.id)
    expect(reopened?.rootNode.boardStateFEN).toBe(HALF_PLACED_FEN)
    expect(reopened?.setupCompleted).toBe(false) // 接着摆，不是直接进打谱阶段
    db.close()
  })

  it('摆完点"开始打谱"，重启后进的是打谱阶段', () => {
    let db: ChessDatabase = createChessDatabase(dbFilePath)
    const created = db.studyCases.create({
      type: 'endgame',
      title: '单车例胜',
      initialFEN: EMPTY_BOARD_FEN
    })
    db.studyCases.saveSetup(created.id, FULLY_PLACED_FEN, true)
    db.close()

    db = createChessDatabase(dbFilePath)
    const reopened = db.studyCases.getById(created.id)
    expect(reopened?.rootNode.boardStateFEN).toBe(FULLY_PLACED_FEN)
    expect(reopened?.setupCompleted).toBe(true)
    db.close()
  })

  it('"重新摆局"只把阶段标记翻回去，起始局面原样留着给用户改', () => {
    const db = createChessDatabase(dbFilePath)
    const created = db.studyCases.create({ type: 'midgame', title: '弃马陷车', initialFEN: EMPTY_BOARD_FEN })
    db.studyCases.saveSetup(created.id, FULLY_PLACED_FEN, true)

    const reopened = db.studyCases.saveSetup(created.id, null, false)
    expect(reopened?.setupCompleted).toBe(false)
    expect(reopened?.rootNode.boardStateFEN).toBe(FULLY_PLACED_FEN)
    db.close()
  })

  it('整局案例从标准开局起手，没有摆局阶段', () => {
    const db = createChessDatabase(dbFilePath)
    const created = db.studyCases.create({
      type: 'fullgame',
      title: '一盘整局',
      initialFEN: STANDARD_START_FEN
    })
    expect(created.setupCompleted).toBe(true)
    expect(db.studyCases.getById(created.id)?.setupCompleted).toBe(true)
    db.close()
  })
})

describe('老数据库补 setup_completed 这一列', () => {
  /** 把连接里的 study_cases 换成"加这一列之前"的旧表结构，用来模拟老版本程序留下的库文件 */
  function downgradeToLegacySchema(db: ChessDatabase): void {
    db.raw.exec('DROP TABLE study_cases')
    db.raw.exec(`
      CREATE TABLE study_cases (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        root_node_id TEXT NOT NULL REFERENCES move_nodes(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
  }

  function insertLegacyCase(
    db: ChessDatabase,
    id: string,
    type: string,
    rootFen: string,
    childMoves: number
  ): void {
    const root = db.moveNodes.create({ parentId: null, move: '', moveCoord: '', boardStateFEN: rootFen })
    for (let i = 0; i < childMoves; i++) {
      db.moveNodes.create({
        parentId: root.id,
        move: '炮二平五',
        moveCoord: 'h2e2',
        boardStateFEN: STANDARD_START_FEN
      })
    }
    db.raw
      .prepare(
        `INSERT INTO study_cases (id, type, title, folder_id, root_node_id, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?)`
      )
      .run(id, type, id, root.id, Date.now(), Date.now())
  }

  function columnNames(db: ChessDatabase): string[] {
    const rows = db.raw.prepare('PRAGMA table_info(study_cases)').all() as Array<{ name: string }>
    return rows.map((row) => row.name)
  }

  it('回填：老案例只要摆过子或者记过走法，就算摆局早就结束了；空白且没走法的接着摆', () => {
    let db = createChessDatabase(dbFilePath)
    downgradeToLegacySchema(db)
    expect(columnNames(db)).not.toContain('setup_completed') // 先确认造出来的确实是老库
    insertLegacyCase(db, 'placed', 'endgame', FULLY_PLACED_FEN, 0)
    insertLegacyCase(db, 'recorded', 'midgame', EMPTY_BOARD_FEN, 2)
    insertLegacyCase(db, 'untouched', 'midgame', EMPTY_BOARD_FEN, 0)
    insertLegacyCase(db, 'full', 'fullgame', STANDARD_START_FEN, 0)
    db.close()

    // ---------- 装了新版本的程序，重新打开这个库 ----------
    db = createChessDatabase(dbFilePath)
    expect(columnNames(db)).toContain('setup_completed')
    expect(db.studyCases.getById('placed')?.setupCompleted).toBe(true)
    expect(db.studyCases.getById('recorded')?.setupCompleted).toBe(true)
    expect(db.studyCases.getById('full')?.setupCompleted).toBe(true)
    // 空白棋盘 + 一步没走：当年就是停在摆局阶段的，打开还该回摆局阶段
    expect(db.studyCases.getById('untouched')?.setupCompleted).toBe(false)
    db.close()
  })

  it('补丁可以重复跑：连开三次同一个库，数据不会被改坏', () => {
    let db = createChessDatabase(dbFilePath)
    const created = db.studyCases.create({ type: 'endgame', title: '重复打开', initialFEN: EMPTY_BOARD_FEN })
    db.studyCases.saveSetup(created.id, HALF_PLACED_FEN, false)
    db.close()

    for (let i = 0; i < 3; i++) {
      db = createChessDatabase(dbFilePath)
      expect(db.studyCases.getById(created.id)?.setupCompleted).toBe(false)
      expect(db.studyCases.getById(created.id)?.rootNode.boardStateFEN).toBe(HALF_PLACED_FEN)
      db.close()
    }
  })
})
