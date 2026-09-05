// 开发/演示用的降级方案：`window.chessoc` 只有真正跑在Electron里（预加载脚本执行过）才存在；
// 如果只是用普通浏览器打开 `npm run dev` 起的 http://localhost:5173（阶段2就是这么做视觉验证的），
// `window.chessoc` 会是undefined，棋谱树相关功能全部用不了。
//
// 这个文件提供一份行为等价的浏览器端实现（用localStorage代替SQLite），只在检测到
// window.chessoc缺失时才会被装配上去（见main.tsx）。正式打包的Electron应用里，
// preload脚本一定会先注入真正的window.chessoc，这份代码永远不会被用到。
//
// 注意：这里是刻意重新实现了一份和 src/main/db 语义一致的简化版仓库逻辑，因为渲染进程
// 打包环境里不能import任何依赖 node:sqlite 的代码——两边保持"接口一致、各自独立实现"，
// 而不是强行共享代码。

import type {
  ChessOCBridge,
  CreateFolderRequest,
  CreateMoveNodeRequest,
  CreateOpeningStudyRequest,
  CreateStudyCaseRequest
} from '@shared/ipc'
import { EMPTY_BOARD_FEN, STANDARD_START_FEN } from '@shared/chess'
import type { Folder, MoveNode, OpeningPieceType, OpeningRoot, OpeningStudy, StudyCase } from '@shared/moveTree'
import { initialFenForStudyCase } from '@shared/moveTree'
import type { EngineStatus } from '@shared/engine'

const STORAGE_KEY = 'chessoc-browser-fallback-db-v1'

// 和 src/main/db/openingStudyRepository.ts 里的 CENTER_LABELS 保持一致，浏览器演示模式独立维护一份
const CENTER_LABELS: Record<OpeningPieceType, string> = {
  N: '起马局',
  B: '飞象局',
  C: '当头炮局',
  R: '直车局',
  P: '挺兵局'
}

interface FallbackDbShape {
  moveNodes: Record<string, MoveNode>
  openingStudies: Record<string, { id: string; pieceType: OpeningStudy['pieceType']; title: string; rootNodeId: string; createdAt: number; updatedAt: number }>
  studyCases: Record<string, { id: string; type: StudyCase['type']; title: string; folderId: string | null; rootNodeId: string; setupCompleted?: boolean; createdAt: number; updatedAt: number }>
  folders: Record<string, Folder>
}

function emptyDb(): FallbackDbShape {
  return { moveNodes: {}, openingStudies: {}, studyCases: {}, folders: {} }
}

function loadDb(): FallbackDbShape {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptyDb()
  try {
    const parsed = JSON.parse(raw) as Partial<FallbackDbShape>
    // 兼容阶段5之前存下的旧数据（没有folders这个键）
    return { ...emptyDb(), ...parsed }
  } catch {
    return emptyDb()
  }
}

function deleteMoveNodeSubtree(db: FallbackDbShape, nodeId: string): void {
  const node = db.moveNodes[nodeId]
  if (!node) return
  for (const childId of childrenIdsOf(db, nodeId)) {
    deleteMoveNodeSubtree(db, childId)
  }
  delete db.moveNodes[nodeId]
}

function saveDb(db: FallbackDbShape): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

function childrenIdsOf(db: FallbackDbShape, nodeId: string): string[] {
  return Object.values(db.moveNodes)
    .filter((n) => n.parentId === nodeId)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((n) => n.id)
}

function withChildrenIds(db: FallbackDbShape, node: MoveNode): MoveNode {
  return { ...node, childrenIds: childrenIdsOf(db, node.id) }
}

/**
 * 把存储行拼成完整的 StudyCase，顺带回填 setupCompleted。
 * localStorage 里可能还躺着加这个字段之前存下的老数据，回填口径和主进程侧的
 * migrations.ts 保持一致：整局、或者根节点已经不是空棋盘、或者已经记了走法，都算摆局早就结束了。
 */
function toStudyCase(db: FallbackDbShape, row: FallbackDbShape['studyCases'][string]): StudyCase {
  const rootNode = withChildrenIds(db, db.moveNodes[row.rootNodeId])
  const setupCompleted =
    row.setupCompleted ??
    (row.type === 'fullgame' ||
      rootNode.boardStateFEN !== EMPTY_BOARD_FEN ||
      rootNode.childrenIds.length > 0)
  return { ...row, rootNode, setupCompleted }
}

function createMoveNode(db: FallbackDbShape, input: CreateMoveNodeRequest | { parentId: null; move: string; moveCoord: string; boardStateFEN: string }): MoveNode {
  const id = crypto.randomUUID()
  const node: MoveNode = {
    id,
    parentId: input.parentId,
    childrenIds: [],
    move: input.move,
    moveCoord: input.moveCoord,
    boardStateFEN: input.boardStateFEN,
    note: null,
    hasNote: false,
    createdAt: Date.now()
  }
  db.moveNodes[id] = node
  return node
}

export function createBrowserFallbackBridge(): ChessOCBridge {
  return {
    appName: 'TtzChess（浏览器演示模式，数据存在localStorage，不是真正的SQLite）',
    versions: { electron: '-', chrome: navigator.userAgent, node: '-' },
    moveTree: {
      async createOpeningStudy(input: CreateOpeningStudyRequest): Promise<OpeningStudy> {
        const db = loadDb()
        const rootNode = createMoveNode(db, { parentId: null, move: '', moveCoord: '', boardStateFEN: STANDARD_START_FEN })
        const now = Date.now()
        const id = crypto.randomUUID()
        db.openingStudies[id] = { id, pieceType: input.pieceType, title: input.title, rootNodeId: rootNode.id, createdAt: now, updatedAt: now }
        saveDb(db)
        return { id, pieceType: input.pieceType, title: input.title, rootNode, createdAt: now, updatedAt: now }
      },
      async listOpeningStudies(): Promise<OpeningStudy[]> {
        const db = loadDb()
        return Object.values(db.openingStudies)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((row) => ({ ...row, rootNode: withChildrenIds(db, db.moveNodes[row.rootNodeId]) }))
      },
      async listOpeningRoots(): Promise<OpeningRoot[]> {
        const db = loadDb()
        const grouped = new Map<OpeningPieceType, string[]>()
        for (const row of Object.values(db.openingStudies).sort((a, b) => a.createdAt - b.createdAt)) {
          const studyIds = grouped.get(row.pieceType) ?? []
          studyIds.push(row.id)
          grouped.set(row.pieceType, studyIds)
        }
        return Array.from(grouped.entries()).map(([pieceType, studyIds]) => ({
          pieceType,
          centerLabel: CENTER_LABELS[pieceType],
          studyIds
        }))
      },
      async getOpeningStudy(id: string): Promise<OpeningStudy | null> {
        const db = loadDb()
        const row = db.openingStudies[id]
        if (!row) return null
        return { ...row, rootNode: withChildrenIds(db, db.moveNodes[row.rootNodeId]) }
      },
      async touchOpeningStudy(id: string): Promise<void> {
        const db = loadDb()
        const row = db.openingStudies[id]
        if (!row) return
        row.updatedAt = Date.now()
        saveDb(db)
      },

      async createStudyCase(input: CreateStudyCaseRequest): Promise<StudyCase> {
        const db = loadDb()
        const rootNode = createMoveNode(db, {
          parentId: null,
          move: '',
          moveCoord: '',
          boardStateFEN: initialFenForStudyCase(input.type)
        })
        const now = Date.now()
        const id = crypto.randomUUID()
        const folderId = input.folderId ?? null
        const setupCompleted = input.type === 'fullgame'
        db.studyCases[id] = {
          id,
          type: input.type,
          title: input.title,
          folderId,
          rootNodeId: rootNode.id,
          setupCompleted,
          createdAt: now,
          updatedAt: now
        }
        saveDb(db)
        return { id, type: input.type, title: input.title, folderId, rootNode, setupCompleted, createdAt: now, updatedAt: now }
      },
      async listStudyCases(): Promise<StudyCase[]> {
        const db = loadDb()
        return Object.values(db.studyCases)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((row) => toStudyCase(db, row))
      },
      async getStudyCase(id: string): Promise<StudyCase | null> {
        const db = loadDb()
        const row = db.studyCases[id]
        if (!row) return null
        return toStudyCase(db, row)
      },
      async touchStudyCase(id: string): Promise<void> {
        const db = loadDb()
        const row = db.studyCases[id]
        if (!row) return
        row.updatedAt = Date.now()
        saveDb(db)
      },
      async saveStudyCaseSetup(
        id: string,
        boardStateFEN: string | null,
        setupCompleted: boolean
      ): Promise<StudyCase | null> {
        const db = loadDb()
        const row = db.studyCases[id]
        if (!row) return null
        if (boardStateFEN !== null) {
          const rootNode = db.moveNodes[row.rootNodeId]
          if (rootNode) rootNode.boardStateFEN = boardStateFEN
        }
        row.setupCompleted = setupCompleted
        row.updatedAt = Date.now()
        saveDb(db)
        return toStudyCase(db, row)
      },

      async loadTree(rootNodeId: string): Promise<MoveNode[]> {
        const db = loadDb()
        const result: MoveNode[] = []
        const queue = [rootNodeId]
        const seen = new Set<string>()
        while (queue.length > 0) {
          const currentId = queue.shift() as string
          if (seen.has(currentId)) continue
          seen.add(currentId)
          const node = db.moveNodes[currentId]
          if (!node) continue
          const withChildren = withChildrenIds(db, node)
          result.push(withChildren)
          queue.push(...withChildren.childrenIds)
        }
        return result
      },
      async createMoveNode(input: CreateMoveNodeRequest): Promise<MoveNode> {
        const db = loadDb()
        const node = createMoveNode(db, input)
        saveDb(db)
        return node
      },
      async setNote(nodeId: string, note: string | null): Promise<MoveNode | null> {
        const db = loadDb()
        const node = db.moveNodes[nodeId]
        if (!node) return null
        const normalized = note && note.length > 0 ? note : null
        node.note = normalized
        node.hasNote = normalized !== null
        saveDb(db)
        return withChildrenIds(db, node)
      },
      async updateBoardState(nodeId: string, boardStateFEN: string): Promise<MoveNode | null> {
        const db = loadDb()
        const node = db.moveNodes[nodeId]
        if (!node) return null
        node.boardStateFEN = boardStateFEN
        saveDb(db)
        return withChildrenIds(db, node)
      },

      async createFolder(input: CreateFolderRequest): Promise<Folder> {
        const db = loadDb()
        const id = crypto.randomUUID()
        const folder: Folder = { id, name: input.name, parentFolderId: input.parentFolderId ?? null }
        db.folders[id] = folder
        saveDb(db)
        return folder
      },
      async listFolders(parentFolderId: string | null): Promise<Folder[]> {
        const db = loadDb()
        return Object.values(db.folders).filter((f) => f.parentFolderId === parentFolderId)
      },
      async listAllFolders(): Promise<Folder[]> {
        const db = loadDb()
        return Object.values(db.folders)
      },
      async renameFolder(id: string, name: string): Promise<Folder | null> {
        const db = loadDb()
        const folder = db.folders[id]
        if (!folder) return null
        folder.name = name
        saveDb(db)
        return folder
      },
      async deleteFolder(id: string): Promise<void> {
        const db = loadDb()
        delete db.folders[id]
        // 模拟SQLite那边的 ON DELETE SET NULL：子文件夹变顶层，里面的案例变未分类
        for (const folder of Object.values(db.folders)) {
          if (folder.parentFolderId === id) folder.parentFolderId = null
        }
        for (const studyCase of Object.values(db.studyCases)) {
          if (studyCase.folderId === id) studyCase.folderId = null
        }
        saveDb(db)
      },

      async listStudyCasesByFolder(folderId: string | null): Promise<StudyCase[]> {
        const db = loadDb()
        return Object.values(db.studyCases)
          .filter((row) => row.folderId === folderId)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((row) => toStudyCase(db, row))
      },
      async searchStudyCases(keyword: string): Promise<StudyCase[]> {
        const db = loadDb()
        const lowered = keyword.toLowerCase()
        return Object.values(db.studyCases)
          .filter((row) => row.title.toLowerCase().includes(lowered))
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((row) => toStudyCase(db, row))
      },
      async renameStudyCase(id: string, title: string): Promise<StudyCase | null> {
        const db = loadDb()
        const row = db.studyCases[id]
        if (!row) return null
        row.title = title
        row.updatedAt = Date.now()
        saveDb(db)
        return toStudyCase(db, row)
      },
      async moveStudyCaseToFolder(id: string, folderId: string | null): Promise<StudyCase | null> {
        const db = loadDb()
        const row = db.studyCases[id]
        if (!row) return null
        row.folderId = folderId
        row.updatedAt = Date.now()
        saveDb(db)
        return toStudyCase(db, row)
      },
      async deleteStudyCase(id: string): Promise<void> {
        const db = loadDb()
        const row = db.studyCases[id]
        if (!row) return
        delete db.studyCases[id]
        deleteMoveNodeSubtree(db, row.rootNodeId)
        saveDb(db)
      },
      async deleteMoveNode(nodeId: string): Promise<void> {
        const db = loadDb()
        const node = db.moveNodes[nodeId]
        if (!node || node.parentId === null) return
        deleteMoveNodeSubtree(db, nodeId)
        saveDb(db)
      }
    },
    engine: {
      // Pikafish是一个真正的子进程，浏览器里没有Node能力，没法伪造，
      // 浏览器演示模式下"AI分析"功能统一提示用户改用真正的Electron应用
      async analyzePosition(): Promise<never> {
        throw new Error('引擎分析功能只在Electron应用里可用，浏览器演示模式无法调用Pikafish子进程')
      },
      async getStatus(): Promise<EngineStatus> {
        return { state: 'unavailable', reason: '浏览器演示模式不支持引擎分析' }
      }
    }
  }
}
