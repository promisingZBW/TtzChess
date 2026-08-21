// 验收标准（journal.md阶段7）：对同一组测试局面，TS版本输出结果与Python原型逐项一致。
// 下面每个用例的期望值都是拿这套局面实际跑了一遍 xiangqi_feature_extraction.py 交叉验证过的，
// 不是凭感觉编的数字。
import { describe, expect, it } from 'vitest'
import { parseFen } from '@shared/chess'
import {
  buildMoveFeatureDiff,
  detectDiscoveredThreats,
  findThreats,
  materialDiff,
  mobilityDiff
} from '@shared/chess'

function boardFromFenPart(fenBoardPart: string) {
  return parseFen(`${fenBoardPart} w - - 0 1`).board
}

describe('materialDiff / mobilityDiff（对齐Python原型的material_diff/mobility_diff）', () => {
  it('标准开局局面：双方对称，子力差和机动性差都是0', () => {
    const board = boardFromFenPart(
      'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR'
    )
    expect(materialDiff(board)).toBe(0)
    expect(mobilityDiff(board)).toBe(0)
  })

  it('红方缺一个马：子力差-270，机动性差1（数值来自Python原型实测）', () => {
    const board = boardFromFenPart(
      'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKAB1R'
    )
    expect(materialDiff(board)).toBe(-270)
    expect(mobilityDiff(board)).toBe(1)
  })

  it('只有红车+黑马的简单局面：子力差330，机动性差13', () => {
    const board = boardFromFenPart('4n4/9/9/9/9/9/4R4/9/9/9')
    expect(materialDiff(board)).toBe(330)
    expect(mobilityDiff(board)).toBe(13)
  })
})

describe('findThreats（对齐Python原型的find_threats）', () => {
  it('红车和黑马同列、中间无遮挡：车威胁到马（马价值270达到威胁门槛）', () => {
    const board = boardFromFenPart('4n4/9/9/9/9/9/4R4/9/9/9')
    const threats = findThreats(board, 'red')
    expect(threats).toEqual([
      {
        attacker: { pos: { row: 6, col: 4 }, piece: { kind: 'R', side: 'red' } },
        target: { pos: { row: 0, col: 4 }, piece: { kind: 'N', side: 'black' } }
      }
    ])
  })

  it('车被己方炮挡住，看不到马，不构成威胁', () => {
    const board = boardFromFenPart('4n4/9/9/4C4/9/9/4R4/9/9/9')
    expect(findThreats(board, 'red')).toEqual([])
  })
})

describe('detectDiscoveredThreats（抽将识别）', () => {
  // 红炮(3,4)挡在红车(6,4)和黑马(0,4)之间的第4列上，车打不到马；
  // 炮横移到(3,2)之后（不经过第4列），车的攻击线露出来，突然威胁到马——
  // 这个新威胁的发起者是没动过的车，不是刚才实际移动的炮，应该被标记成"疑似抽将"
  const before = boardFromFenPart('4n4/9/9/4C4/9/9/4R4/9/9/9')
  const after = boardFromFenPart('4n4/9/9/2C6/9/9/4R4/9/9/9')
  const cannonMove = { from: { row: 3, col: 4 }, to: { row: 3, col: 2 } }

  it('移动前没有任何威胁', () => {
    expect(findThreats(before, 'red')).toEqual([])
  })

  it('移动后车露出了对马的威胁，机动性差从21变成30', () => {
    // "移动前"这个数字和Python原型直接跑出来的22不一样（TS这里是21），原因不是bug：
    // moves.ts开头就写明了——Python原型的车/炮走法生成没有排除"落在己方棋子格子上"这种非法走法
    // （这个场景里车被自己的炮挡住，Python会把"车走到炮所在格子"也错误地算成一步机动性）；
    // TS作为真正的规则引擎，正确地把这种自吃己方棋子的走法排除了，所以比Python原型少1。
    // "移动后"这个局面里已经没有任何己方棋子互相遮挡的情况，两边算出来的30是完全一致的。
    expect(mobilityDiff(before)).toBe(21)
    expect(mobilityDiff(after)).toBe(30)
    expect(materialDiff(before)).toBe(615)
    expect(materialDiff(after)).toBe(615) // 只是挪位置，没有吃子，子力差不变
    expect(findThreats(after, 'red')).toEqual([
      {
        attacker: { pos: { row: 6, col: 4 }, piece: { kind: 'R', side: 'red' } },
        target: { pos: { row: 0, col: 4 }, piece: { kind: 'N', side: 'black' } }
      }
    ])
  })

  it('这个新增威胁的发起棋子(车)不是本步实际移动的棋子(炮)，应该被标记成疑似抽将', () => {
    const discovered = detectDiscoveredThreats(before, after, cannonMove, 'red')
    expect(discovered).toHaveLength(1)
    expect(discovered[0].attacker.pos).toEqual({ row: 6, col: 4 })
  })

  it('如果威胁的发起者正是刚移动的那颗子（普通直接威胁，不是抽将），不应该被算成抽将', () => {
    // 车自己从不对齐的位置(9,2)移动到(6,4)，正好和黑马同列——这是车自己造出来的直接威胁，
    // 不是"移开别的子露出来的"，不应该被标记成抽将
    const directBefore = boardFromFenPart('4n4/9/9/9/9/9/9/9/9/2R6')
    const directAfter = boardFromFenPart('4n4/9/9/9/9/9/4R4/9/9/9')
    const rookMove = { from: { row: 9, col: 2 }, to: { row: 6, col: 4 } }
    expect(findThreats(directBefore, 'red')).toEqual([])
    expect(findThreats(directAfter, 'red')).toHaveLength(1)
    const discovered = detectDiscoveredThreats(directBefore, directAfter, rookMove, 'red')
    expect(discovered).toEqual([])
  })
})

describe('buildMoveFeatureDiff（整合特征摘要，对应Python的build_feature_summary）', () => {
  it('把子力差/机动性差/威胁/抽将标记整合到一份摘要里', () => {
    const before = boardFromFenPart('4n4/9/9/4C4/9/9/4R4/9/9/9')
    const after = boardFromFenPart('4n4/9/9/2C6/9/9/4R4/9/9/9')
    const move = { from: { row: 3, col: 4 }, to: { row: 3, col: 2 } }

    const summary = buildMoveFeatureDiff(before, after, move, 'red')
    expect(summary.materialDiffBefore).toBe(615)
    expect(summary.materialDiffAfter).toBe(615)
    expect(summary.mobilityDiffBefore).toBe(21)
    expect(summary.mobilityDiffAfter).toBe(30)
    expect(summary.threatsAfter).toHaveLength(1)
    expect(summary.discoveredThreats).toHaveLength(1)
  })
})
