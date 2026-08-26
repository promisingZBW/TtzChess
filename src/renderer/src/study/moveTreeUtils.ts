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

/** 收集某个节点及其全部子孙的 id，删除光球时用来同步清掉本地缓存 */
export function collectSubtreeIds(nodes: Map<string, MoveNode>, rootId: string): string[] {
  const ids: string[] = []
  const queue = [rootId]
  const visited = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift() as string
    if (visited.has(id)) continue
    visited.add(id)
    ids.push(id)
    const node = nodes.get(id)
    if (node) queue.push(...node.childrenIds)
  }
  return ids
}

/**
 * 前进时下一步该去哪个节点：
 * - 当前还不在 activePath 末尾，就沿这条已经走过的路往前走（保证后退后再前进回到原路）
 * - 已经在末尾，但当前节点还有子节点，就走进第一个子节点（主线），这样可以连续按前进
 */
export function nextForwardNodeId(
  nodes: Map<string, MoveNode>,
  activePath: string[],
  cursorIndex: number
): string | null {
  if (cursorIndex < 0 || cursorIndex >= activePath.length) return null
  if (cursorIndex < activePath.length - 1) return activePath[cursorIndex + 1]
  const current = nodes.get(activePath[cursorIndex])
  if (!current || current.childrenIds.length === 0) return null
  return current.childrenIds[0]
}
