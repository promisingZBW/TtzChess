// 纯数据变换工具：把"扁平的 id->MoveNode 映射"（IPC读回来的树缓存）转换成
// d3.hierarchy() 需要的嵌套结构，以及"给定节点id反查根到该节点的完整路径"。
// 不涉及任何UI/IPC，方便单独写单元测试。

import type { MoveNode } from '@shared/moveTree'

export interface TreeHierarchyNode {
  id: string
  node: MoveNode
  children: TreeHierarchyNode[]
}

/** 把 nodes 里以 rootId 为根的一棵子树，组装成 d3.hierarchy() 能直接使用的嵌套结构 */
export function buildHierarchy(nodes: Map<string, MoveNode>, rootId: string): TreeHierarchyNode | null {
  const root = nodes.get(rootId)
  if (!root) return null

  function build(id: string): TreeHierarchyNode {
    const node = nodes.get(id)
    if (!node) {
      throw new Error(`棋谱树数据异常：找不到id为${id}的节点（父节点的childrenIds指向了一个不存在的节点）`)
    }
    return { id, node, children: node.childrenIds.map(build) }
  }

  return build(rootId)
}

/**
 * 从本地缓存的节点映射里，沿parentId一路往上走，拼出"根节点到目标节点"的完整路径（根在前，目标节点在后）。
 * 逻辑和阶段3 `MoveNodeRepository.getPathFromRoot` 完全一致，只是这里操作的是renderer已经缓存好的
 * 内存数据，不需要再走一次IPC——棋谱树整棵都已经在阶段4加载进内存了，本地查更快。
 */
export function computePathFromRoot(nodes: Map<string, MoveNode>, nodeId: string): string[] {
  const path: string[] = []
  let currentId: string | null = nodeId
  const visited = new Set<string>()
  while (currentId !== null) {
    if (visited.has(currentId)) {
      throw new Error(`棋谱树数据异常：父子关系里检测到环（节点id: ${currentId}）`)
    }
    visited.add(currentId)
    const node: MoveNode | undefined = nodes.get(currentId)
    if (!node) break
    path.push(currentId)
    currentId = node.parentId
  }
  return path.reverse()
}
