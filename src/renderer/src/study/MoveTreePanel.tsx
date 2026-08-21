// 右侧"光球棋谱树"面板（dev guide 5.3节）：用 d3.tree() 计算节点的布局坐标（自上而下逐层展开），
// 渲染成SVG的圆点+连线。交互：左键跳转局面（同时若该节点有笔记就弹出笔记方框）、
// 右键弹出菜单（添加分支/增加笔记）。
//
// 简化说明（已在journal.md记录）：guide原文描述笔记方框"在光球左侧展开"，这里简化成
// 面板底部的一个固定笔记区域，不做逐节点的精确像素定位——交互功能（查看/编辑/关闭笔记）
// 完整保留，只是视觉呈现方式更简单、更不容易在树很大时被其他节点遮挡。

import { useMemo, useState } from 'react'
import { hierarchy, linkVertical, tree } from 'd3'
import type { HierarchyPointLink, HierarchyPointNode } from 'd3'
import type { MoveNode } from '@shared/moveTree'
import { buildHierarchy, type TreeHierarchyNode } from './moveTreeUtils'

const NODE_RADIUS = 11
const H_SPACING = 56
const V_SPACING = 74
const PADDING = 40

interface ContextMenuState {
  nodeId: string
  x: number
  y: number
}

interface NoteBoxState {
  nodeId: string
  mode: 'view' | 'edit'
}

interface MoveTreePanelProps {
  nodes: Map<string, MoveNode>
  rootNodeId: string
  currentNodeId: string | null
  activePath: string[]
  onJumpToNode: (nodeId: string) => void
  onAddBranch: (nodeId: string) => void
  onSetNote: (nodeId: string, text: string | null) => Promise<void>
}

export function MoveTreePanel({
  nodes,
  rootNodeId,
  currentNodeId,
  activePath,
  onJumpToNode,
  onAddBranch,
  onSetNote
}: MoveTreePanelProps): React.JSX.Element {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [noteBox, setNoteBox] = useState<NoteBoxState | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const layout = useMemo(() => {
    const hierarchyData = buildHierarchy(nodes, rootNodeId)
    if (!hierarchyData) return null

    const root = hierarchy<TreeHierarchyNode>(hierarchyData, (d) => d.children)
    const positioned: HierarchyPointNode<TreeHierarchyNode> = tree<TreeHierarchyNode>()
      .nodeSize([H_SPACING, V_SPACING])(root)

    const descendants = positioned.descendants()
    const xs = descendants.map((d) => d.x)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...descendants.map((d) => d.y))

    return {
      descendants,
      links: positioned.links(),
      width: maxX - minX + PADDING * 2,
      height: maxY + PADDING * 2,
      offsetX: PADDING - minX
    }
  }, [nodes, rootNodeId])

  const activePathSet = useMemo(() => new Set(activePath), [activePath])

  const linkGenerator = useMemo(
    () =>
      linkVertical<HierarchyPointLink<TreeHierarchyNode>, HierarchyPointNode<TreeHierarchyNode>>()
        .x((d) => d.x)
        .y((d) => d.y),
    []
  )

  function openNoteBox(nodeId: string, mode: 'view' | 'edit'): void {
    setNoteDraft(nodes.get(nodeId)?.note ?? '')
    setNoteBox({ nodeId, mode })
    setContextMenu(null)
  }

  if (!layout) {
    return <div className="move-tree-panel move-tree-panel-empty">棋谱树是空的，在棋盘上走第一步棋吧。</div>
  }

  const noteBoxNode = noteBox ? nodes.get(noteBox.nodeId) : null

  return (
    <div className="move-tree-panel">
      <svg width={layout.width} height={layout.height}>
        <g transform={`translate(${layout.offsetX}, ${PADDING})`}>
          {layout.links.map((link, index) => (
            <path key={index} className="tree-link" d={linkGenerator(link) ?? undefined} />
          ))}
          {layout.descendants.map((d) => {
            const node = d.data.node
            const isCurrent = d.data.id === currentNodeId
            const onPath = activePathSet.has(d.data.id)
            const colorClass = node.hasNote ? 'tree-node-noted' : 'tree-node-plain'
            return (
              <g
                key={d.data.id}
                transform={`translate(${d.x}, ${d.y})`}
                className="tree-node-group"
                onClick={() => {
                  onJumpToNode(d.data.id)
                  if (node.hasNote) {
                    openNoteBox(d.data.id, 'view')
                  } else {
                    setNoteBox(null)
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({ nodeId: d.data.id, x: e.clientX, y: e.clientY })
                }}
              >
                {onPath && <circle className="tree-node-path-ring" r={NODE_RADIUS + 5} />}
                <circle className={`tree-node ${colorClass}${isCurrent ? ' tree-node-current' : ''}`} r={NODE_RADIUS} />
                <text className="tree-node-label" y={NODE_RADIUS + 14} textAnchor="middle">
                  {node.move || '起始局面'}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {contextMenu && (
        <>
          <div className="context-menu-overlay" onClick={() => setContextMenu(null)} />
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button
              onClick={() => {
                onAddBranch(contextMenu.nodeId)
                setContextMenu(null)
              }}
            >
              添加分支
            </button>
            <button onClick={() => openNoteBox(contextMenu.nodeId, 'edit')}>增加笔记</button>
          </div>
        </>
      )}

      {noteBox && noteBoxNode && (
        <div className="note-box">
          <div className="note-box-header">
            <span>「{noteBoxNode.move || '起始局面'}」的笔记</span>
            <button className="note-box-close" onClick={() => setNoteBox(null)}>
              ×
            </button>
          </div>
          {noteBox.mode === 'view' ? (
            <>
              <p className="note-box-content">{noteBoxNode.note}</p>
              <button onClick={() => setNoteBox({ ...noteBox, mode: 'edit' })}>编辑</button>
            </>
          ) : (
            <>
              <textarea
                className="note-box-textarea"
                placeholder="可以在此处添加笔记"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <div className="note-box-actions">
                <button
                  onClick={async () => {
                    await onSetNote(noteBox.nodeId, noteDraft)
                    setNoteBox((prev) => (prev ? { ...prev, mode: 'view' } : prev))
                  }}
                >
                  保存
                </button>
                {noteBoxNode.hasNote && (
                  <button
                    onClick={async () => {
                      await onSetNote(noteBox.nodeId, null)
                      setNoteBox(null)
                    }}
                  >
                    删除笔记
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
