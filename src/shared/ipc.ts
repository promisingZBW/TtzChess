// 渲染进程与主进程之间通过 preload 暴露的桥接接口定义。
// 后续阶段（棋谱存储、引擎调用等）新增的 IPC 接口都应该先在这里补充类型，
// 保证 main / preload / renderer 三端类型一致。

export interface ChessOCVersions {
  electron: string
  chrome: string
  node: string
}

export interface ChessOCBridge {
  appName: string
  versions: ChessOCVersions
}
