import { contextBridge, ipcRenderer } from 'electron'
import { ENGINE_CHANNELS, MOVE_TREE_CHANNELS } from '../shared/ipc'
import type {
  ChessOCBridge,
  CreateFolderRequest,
  CreateMoveNodeRequest,
  CreateOpeningStudyRequest,
  CreateStudyCaseRequest
} from '../shared/ipc'

const api: ChessOCBridge = {
    appName: 'TtzChess',
  versions: {
    electron: process.versions.electron ?? '',
    chrome: process.versions.chrome ?? '',
    node: process.versions.node ?? ''
  },
  moveTree: {
    createOpeningStudy: (input: CreateOpeningStudyRequest) =>
      ipcRenderer.invoke(MOVE_TREE_CHANNELS.createOpeningStudy, input),
    listOpeningStudies: () => ipcRenderer.invoke(MOVE_TREE_CHANNELS.listOpeningStudies),
    listOpeningRoots: () => ipcRenderer.invoke(MOVE_TREE_CHANNELS.listOpeningRoots),
    getOpeningStudy: (id: string) => ipcRenderer.invoke(MOVE_TREE_CHANNELS.getOpeningStudy, id),
    touchOpeningStudy: (id: string) => ipcRenderer.invoke(MOVE_TREE_CHANNELS.touchOpeningStudy, id),

    createStudyCase: (input: CreateStudyCaseRequest) =>
      ipcRenderer.invoke(MOVE_TREE_CHANNELS.createStudyCase, input),
    listStudyCases: () => ipcRenderer.invoke(MOVE_TREE_CHANNELS.listStudyCases),
    getStudyCase: (id: string) => ipcRenderer.invoke(MOVE_TREE_CHANNELS.getStudyCase, id),
    touchStudyCase: (id: string) => ipcRenderer.invoke(MOVE_TREE_CHANNELS.touchStudyCase, id),
    saveStudyCaseSetup: (id: string, boardStateFEN: string | null, setupCompleted: boolean) =>
      ipcRenderer.invoke(MOVE_TREE_CHANNELS.saveStudyCaseSetup, id, boardStateFEN, setupCompleted),

    loadTree: (rootNodeId: string) => ipcRenderer.invoke(MOVE_TREE_CHANNELS.loadTree, rootNodeId),
    createMoveNode: (input: CreateMoveNodeRequest) =>
      ipcRenderer.invoke(MOVE_TREE_CHANNELS.createMoveNode, input),
    deleteMoveNode: (nodeId: string) => ipcRenderer.invoke(MOVE_TREE_CHANNELS.deleteMoveNode, nodeId),
    setNote: (nodeId: string, note: string | null) =>
      ipcRenderer.invoke(MOVE_TREE_CHANNELS.setNote, nodeId, note),
    updateBoardState: (nodeId: string, boardStateFEN: string) =>
      ipcRenderer.invoke(MOVE_TREE_CHANNELS.updateBoardState, nodeId, boardStateFEN),

    createFolder: (input: CreateFolderRequest) => ipcRenderer.invoke(MOVE_TREE_CHANNELS.createFolder, input),
    listFolders: (parentFolderId: string | null) =>
      ipcRenderer.invoke(MOVE_TREE_CHANNELS.listFolders, parentFolderId),
    listAllFolders: () => ipcRenderer.invoke(MOVE_TREE_CHANNELS.listAllFolders),
    renameFolder: (id: string, name: string) => ipcRenderer.invoke(MOVE_TREE_CHANNELS.renameFolder, id, name),
    deleteFolder: (id: string) => ipcRenderer.invoke(MOVE_TREE_CHANNELS.deleteFolder, id),

    listStudyCasesByFolder: (folderId: string | null) =>
      ipcRenderer.invoke(MOVE_TREE_CHANNELS.listStudyCasesByFolder, folderId),
    searchStudyCases: (keyword: string) => ipcRenderer.invoke(MOVE_TREE_CHANNELS.searchStudyCases, keyword),
    renameStudyCase: (id: string, title: string) =>
      ipcRenderer.invoke(MOVE_TREE_CHANNELS.renameStudyCase, id, title),
    moveStudyCaseToFolder: (id: string, folderId: string | null) =>
      ipcRenderer.invoke(MOVE_TREE_CHANNELS.moveStudyCaseToFolder, id, folderId),
    deleteStudyCase: (id: string) => ipcRenderer.invoke(MOVE_TREE_CHANNELS.deleteStudyCase, id)
  },
  engine: {
    analyzePosition: (fen: string, depth?: number) => ipcRenderer.invoke(ENGINE_CHANNELS.analyzePosition, fen, depth),
    getStatus: () => ipcRenderer.invoke(ENGINE_CHANNELS.getStatus)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('chessoc', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // 未开启上下文隔离时的兼容分支，正式产品里不应该走到这里
  // @ts-expect-error 仅兼容分支使用
  window.chessoc = api
}
