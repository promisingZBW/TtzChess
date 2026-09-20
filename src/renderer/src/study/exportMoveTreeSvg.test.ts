import { describe, expect, it } from 'vitest'
import type { MoveNode } from '@shared/moveTree'
import { renderMoveTreeSvg } from './exportMoveTreeSvg'

function node(id: string, parentId: string | null, move: string, childrenIds: string[], hasNote = false): MoveNode {
  return {
    id,
    parentId,
    childrenIds,
    move,
    moveCoord: '',
    boardStateFEN: '',
    note: hasNote ? '一段笔记' : null,
    hasNote,
    createdAt: 0
  }
}

/** 根 -> 炮二平五 -> {马8进7, 马2进3}，其中一个分支带笔记 */
function sampleTree(): Map<string, MoveNode> {
  return new Map([
    ['root', node('root', null, '', ['a'])],
    ['a', node('a', 'root', '炮二平五', ['b', 'c'])],
    ['b', node('b', 'a', '马8进7', [], true)],
    ['c', node('c', 'a', '马2进3', [])]
  ])
}

describe('renderMoveTreeSvg', () => {
  it('每个节点都画出来，走法文字原样写进 SVG，根节点写成「起始局面」', () => {
    const result = renderMoveTreeSvg(sampleTree(), 'root', '中炮对屏风马')
    expect(result).not.toBeNull()
    const svg = result!.svg

    expect(svg).toContain('起始局面')
    expect(svg).toContain('炮二平五')
    expect(svg).toContain('马8进7')
    expect(svg).toContain('马2进3')
    expect(svg).toContain('中炮对屏风马') // 标题
    expect((svg.match(/<circle /g) ?? [])).toHaveLength(4)
  })

  it('有笔记的节点用另一种颜色，和普通节点区分得开', () => {
    const svg = renderMoveTreeSvg(sampleTree(), 'root', '谱名')!.svg
    expect(svg).toContain('#b3261e') // 带笔记：朱红
    expect(svg).toContain('#4f7d5a') // 普通：青
  })

  it('输出的是一张自带背景和尺寸的完整 SVG，拖到别处打开也能看', () => {
    const result = renderMoveTreeSvg(sampleTree(), 'root', '谱名')!
    expect(result.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(result.svg).toContain(`width="${result.width}"`)
    expect(result.svg).toContain('#170f0a') // 背景色，没有它导出来是透明底
    expect(result.width).toBeGreaterThan(0)
    expect(result.height).toBeGreaterThan(0)
  })

  it('谱名里的尖括号引号会被转义，不会撑坏 SVG', () => {
    const svg = renderMoveTreeSvg(sampleTree(), 'root', '<谱 & "名">')!.svg
    expect(svg).toContain('&lt;谱 &amp; &quot;名&quot;&gt;')
  })

  it('谱名很长时画布会跟着变宽，标题不会被裁掉', () => {
    const shortTitle = renderMoveTreeSvg(sampleTree(), 'root', '短名')!
    const longTitle = renderMoveTreeSvg(sampleTree(), 'root', '中炮过河车对屏风马平炮兑车')!

    expect(longTitle.width).toBeGreaterThan(shortTitle.width)
    // 13 个汉字 18px，加左右边距，至少得有这么宽
    expect(longTitle.width).toBeGreaterThanOrEqual(13 * 18)
  })

  it('树比画布窄时会居中，不会歪在一边', () => {
    const result = renderMoveTreeSvg(sampleTree(), 'root', '中炮过河车对屏风马平炮兑车')!
    // 根节点在树的正中间，它的 x 应该落在画布中线附近
    const rootTranslate = result.svg.match(/translate\(([\d.-]+), 0\)/)
    expect(rootTranslate).not.toBeNull()
    const groupOffset = Number(result.svg.match(/<g transform="translate\(([\d.-]+),/)![1])
    const rootX = groupOffset + Number(rootTranslate![1])
    expect(Math.abs(rootX - result.width / 2)).toBeLessThan(40)
  })

  it('根节点找不到时返回 null，交给调用方提示，而不是抛异常', () => {
    expect(renderMoveTreeSvg(sampleTree(), '不存在的id', '谱名')).toBeNull()
  })
})
