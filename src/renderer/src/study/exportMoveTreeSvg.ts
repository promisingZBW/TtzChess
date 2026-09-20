// 把棋谱树导出成一张独立的 SVG 图。
//
// 为什么不直接把界面上那个 <svg> 抓下来序列化：界面上的颜色全是 CSS 类名给的，
// 序列化出来的 SVG 脱离了页面样式表就是一团黑白线条，还得反过来把每条样式手工内联回去。
// 与其这样，不如照着同一套布局参数重新算一遍坐标、把颜色直接写成属性——生成的图自带样式，
// 拖到哪儿打开都一样，而且这是个纯函数，不依赖棋谱树面板有没有挂载（切到 AI 分析标签页也能导）。
//
// 布局参数刻意和 MoveTreePanel 保持一致，导出的图和界面上看到的是同一个形状。

import { hierarchy, linkVertical, tree } from 'd3'
import type { HierarchyPointLink, HierarchyPointNode } from 'd3'
import type { MoveNode } from '@shared/moveTree'
import { buildHierarchy, type TreeHierarchyNode } from './moveTreeUtils'

const NODE_RADIUS = 11
const H_SPACING = 56
const V_SPACING = 74
const PADDING = 48
/** 给标题留的高度 */
const TITLE_HEIGHT = 52
const TITLE_FONT_SIZE = 18

// 颜色跟 main.css 里的主题变量对齐；导出的图是要发给别人看的，不能依赖运行时的 CSS 变量
const COLORS = {
  background: '#170f0a',
  link: '#6b4a2a',
  plainFill: '#4f7d5a',
  plainStroke: '#325a3d',
  notedFill: '#b3261e',
  notedStroke: '#7a1a15',
  label: '#f0e6d2',
  title: '#e8c877'
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface MoveTreeSvgResult {
  svg: string
  width: number
  height: number
}

export function renderMoveTreeSvg(
  nodes: Map<string, MoveNode>,
  rootNodeId: string,
  title: string
): MoveTreeSvgResult | null {
  const hierarchyData = buildHierarchy(nodes, rootNodeId)
  if (!hierarchyData) return null

  const root = hierarchy<TreeHierarchyNode>(hierarchyData, (d) => d.children)
  const positioned: HierarchyPointNode<TreeHierarchyNode> = tree<TreeHierarchyNode>().nodeSize([
    H_SPACING,
    V_SPACING
  ])(root)

  const descendants = positioned.descendants()
  const xs = descendants.map((d) => d.x)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...descendants.map((d) => d.y))

  // 画布宽度取"树本身的宽度"和"标题那行的宽度"里更大的那个：
  // 一棵只有主线的窄树配一个长谱名时，只按树算会把标题两头裁掉。
  // 汉字在 18px 下差不多就是 18px 宽，按 19 估稍微宽一点，留点余量不至于贴边。
  const treeSpan = maxX - minX
  const titleSpan = title.length * (TITLE_FONT_SIZE + 1)
  const width = Math.round(Math.max(treeSpan, titleSpan) + PADDING * 2)
  const height = Math.round(maxY + PADDING * 2 + TITLE_HEIGHT)
  // 树比画布窄的时候要重新居中，否则树会歪在左边
  const offsetX = (width - treeSpan) / 2 - minX

  const linkGenerator = linkVertical<HierarchyPointLink<TreeHierarchyNode>, HierarchyPointNode<TreeHierarchyNode>>()
    .x((d) => d.x)
    .y((d) => d.y)

  const links = positioned
    .links()
    .map((link) => {
      const d = linkGenerator(link)
      return d ? `<path d="${d}" fill="none" stroke="${COLORS.link}" stroke-width="2"/>` : ''
    })
    .join('')

  const nodeShapes = descendants
    .map((d) => {
      const node = d.data.node
      const fill = node.hasNote ? COLORS.notedFill : COLORS.plainFill
      const stroke = node.hasNote ? COLORS.notedStroke : COLORS.plainStroke
      const label = escapeXml(node.move || '起始局面')
      return (
        `<g transform="translate(${d.x}, ${d.y})">` +
        `<circle r="${NODE_RADIUS}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>` +
        `<text y="${NODE_RADIUS + 14}" text-anchor="middle" font-size="11" fill="${COLORS.label}">${label}</text>` +
        `</g>`
      )
    })
    .join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${COLORS.background}"/>` +
    `<text x="${width / 2}" y="32" text-anchor="middle" font-size="${TITLE_FONT_SIZE}" font-weight="700" ` +
    `font-family="KaiTi, STKaiti, serif" fill="${COLORS.title}">${escapeXml(title)}</text>` +
    `<g transform="translate(${offsetX}, ${PADDING + TITLE_HEIGHT})" ` +
    `font-family="-apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif">` +
    links +
    nodeShapes +
    `</g></svg>`

  return { svg, width, height }
}

/**
 * 把 SVG 字符串画到 canvas 上转成 PNG 的 base64（不含 data: 前缀，直接给主进程写文件）。
 * 放大两倍再画，导出的图拿去放大看文字不会糊。
 */
export async function svgToPngBase64(result: MoveTreeSvgResult, scale = 2): Promise<string> {
  const blob = new Blob([result.svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('棋谱树图片渲染失败'))
      image.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = result.width * scale
    canvas.height = result.height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('当前环境不支持 canvas，无法导出图片')
    ctx.scale(scale, scale)
    ctx.drawImage(image, 0, 0)

    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
  } finally {
    URL.revokeObjectURL(url)
  }
}
