// 渲染进程与主进程之间通过 preload 暴露的桥接接口定义。
// 后续阶段（棋谱存储、引擎调用等）新增的 IPC 接口都应该先在这里补充类型，
// 保证 main / preload / renderer 三端类型一致。
//
// 为什么棋谱树的读写要走IPC，而不是renderer直接import `src/main/db`：
// SQLite（node:sqlite）是Node.js能力，renderer进程出于安全考虑不开nodeIntegration，
// 拿不到Node API，只能通过preload暴露的桥接对象、经IPC转发给main进程去真正读写数据库。

import type {
  Folder,
  MoveNode,
  OpeningPieceType,
  OpeningRoot,
  OpeningStudy,
  StudyCase,
  StudyCaseType
} from './moveTree'
import type { EngineAnalysisResult, EngineStatus } from './engine'

export interface ChessOCVersions {
  electron: string
  chrome: string
  node: string
}

export interface CreateOpeningStudyRequest {
  pieceType: OpeningPieceType
  title: string
}

export interface CreateStudyCaseRequest {
  type: StudyCaseType
  title: string
  /** 不传或传undefined等价于null=未分类，案例库阶段5新建案例时可以直接指定当前所在的文件夹 */
  folderId?: string | null
}

export interface CreateFolderRequest {
  name: string
  parentFolderId?: string | null
}

export interface CreateMoveNodeRequest {
  parentId: string
  move: string
  moveCoord: string
  boardStateFEN: string
}

/** IPC channel名统一放这里，main注册handler、preload转发调用都从这里导入，避免两边字符串打错导致对不上 */
export const MOVE_TREE_CHANNELS = {
  createOpeningStudy: 'moveTree:createOpeningStudy',
  listOpeningStudies: 'moveTree:listOpeningStudies',
  listOpeningRoots: 'moveTree:listOpeningRoots',
  getOpeningStudy: 'moveTree:getOpeningStudy',
  touchOpeningStudy: 'moveTree:touchOpeningStudy',
  createStudyCase: 'moveTree:createStudyCase',
  listStudyCases: 'moveTree:listStudyCases',
  getStudyCase: 'moveTree:getStudyCase',
  touchStudyCase: 'moveTree:touchStudyCase',
  saveStudyCaseSetup: 'moveTree:saveStudyCaseSetup',
  loadTree: 'moveTree:loadTree',
  createMoveNode: 'moveTree:createMoveNode',
  deleteMoveNode: 'moveTree:deleteMoveNode',
  setNote: 'moveTree:setNote',
  updateBoardState: 'moveTree:updateBoardState',

  // 阶段5：案例库的文件夹管理 + 案例搜索/分类/改名/删除
  createFolder: 'moveTree:createFolder',
  listFolders: 'moveTree:listFolders',
  listAllFolders: 'moveTree:listAllFolders',
  renameFolder: 'moveTree:renameFolder',
  deleteFolder: 'moveTree:deleteFolder',

  listStudyCasesByFolder: 'moveTree:listStudyCasesByFolder',
  searchStudyCases: 'moveTree:searchStudyCases',
  renameStudyCase: 'moveTree:renameStudyCase',
  moveStudyCaseToFolder: 'moveTree:moveStudyCaseToFolder',
  deleteStudyCase: 'moveTree:deleteStudyCase'
} as const

/** 阶段6：Pikafish引擎分析相关的IPC channel */
export const ENGINE_CHANNELS = {
  analyzePosition: 'engine:analyzePosition',
  getStatus: 'engine:getStatus'
} as const

export interface MoveTreeBridge {
  createOpeningStudy(input: CreateOpeningStudyRequest): Promise<OpeningStudy>
  listOpeningStudies(): Promise<OpeningStudy[]>
  /** 阶段9：按起手棋子类型分组聚合的棋路列表，径向图首页用来渲染每个中心点下有哪些棋路 */
  listOpeningRoots(): Promise<OpeningRoot[]>
  getOpeningStudy(id: string): Promise<OpeningStudy | null>
  touchOpeningStudy(id: string): Promise<void>

  createStudyCase(input: CreateStudyCaseRequest): Promise<StudyCase>
  listStudyCases(): Promise<StudyCase[]>
  getStudyCase(id: string): Promise<StudyCase | null>
  touchStudyCase(id: string): Promise<void>
  /**
   * 保存中局/残局案例的摆局成果。
   * @param boardStateFEN 摆好的局面；传null表示局面不动，只改阶段标记（"重新摆局"用）
   * @param setupCompleted false=摆局还没结束，下次打开仍回摆局界面；true=进入打谱阶段
   */
  saveStudyCaseSetup(
    id: string,
    boardStateFEN: string | null,
    setupCompleted: boolean
  ): Promise<StudyCase | null>

  /** 从某个根节点开始，把整棵子树都读回来（数组形式，renderer拿到后自己拼成 id->MoveNode 的Map） */
  loadTree(rootNodeId: string): Promise<MoveNode[]>
  createMoveNode(input: CreateMoveNodeRequest): Promise<MoveNode>
  /** 删除一个光球及其后续子树；起始局面（根节点）不允许删 */
  deleteMoveNode(nodeId: string): Promise<void>
  setNote(nodeId: string, note: string | null): Promise<MoveNode | null>
  updateBoardState(nodeId: string, boardStateFEN: string): Promise<MoveNode | null>

  createFolder(input: CreateFolderRequest): Promise<Folder>
  /** parentFolderId传null查顶层文件夹 */
  listFolders(parentFolderId: string | null): Promise<Folder[]>
  /** 不分层级、拿全部文件夹的扁平列表，用于"移动到"下拉框拼路径名 */
  listAllFolders(): Promise<Folder[]>
  renameFolder(id: string, name: string): Promise<Folder | null>
  deleteFolder(id: string): Promise<void>

  /** folderId传null查未分类的案例 */
  listStudyCasesByFolder(folderId: string | null): Promise<StudyCase[]>
  searchStudyCases(keyword: string): Promise<StudyCase[]>
  renameStudyCase(id: string, title: string): Promise<StudyCase | null>
  moveStudyCaseToFolder(id: string, folderId: string | null): Promise<StudyCase | null>
  deleteStudyCase(id: string): Promise<void>
}

export interface EngineBridge {
  /** depth不传时使用主进程侧的默认搜索深度（阶段6目前固定15，见EngineService.DEFAULT_ANALYSIS_DEPTH） */
  analyzePosition(fen: string, depth?: number): Promise<EngineAnalysisResult>
  getStatus(): Promise<EngineStatus>
}

export interface ChessOCBridge {
  appName: string
  versions: ChessOCVersions
  moveTree: MoveTreeBridge
  engine: EngineBridge
}
