// 首页：开局径向图（阶段9）+ 中局/残局案例库入口 + AI分析入口。
// 阶段4之前(App.tsx)默认直接进阶段2的孤立棋盘demo；现在换成这个首页作为真正的入口，
// 阶段2的demo(PlayGroundPage.tsx)代码还留着，只是不再是默认页面了。
//
// 开局棋路那一块，阶段5-8期间一直是"下拉框选棋子类型+输入谱名+列表"的朴素表单实现；
// 阶段9换成径向图（见OpeningSunburst.tsx）：中心=起手棋子类型，用户自己创建的每一条
// 独立棋路是从中心延伸出去的一根线+一个小球。交互行为不变（点中心=新建，点小球=直接
// 进入对应棋路），只是可视化方式升级了。径向图本身不需要棋谱树数据，只需要每条棋路的
// id和谱名，所以这里不再调用 loadTree。

import { useEffect, useState } from 'react'
import type { OpeningPieceType, OpeningRoot } from '@shared/moveTree'
import type { StudySubjectRef } from '../study/useStudySession'
import { buildSunburstCenters, ensureAllPieceTypeRoots, OPENING_CENTER_LABELS } from './openingSunburstUtils'
import type { SunburstCenterData } from './openingSunburstUtils'
import { OpeningSunburst } from './OpeningSunburst'

interface HomePageProps {
  onOpenSubject: (ref: StudySubjectRef) => void
  onOpenLibrary: () => void
  onOpenAnalysis: () => void
}

async function loadSunburstCenters(): Promise<SunburstCenterData[]> {
  const roots: OpeningRoot[] = await window.chessoc.moveTree.listOpeningRoots()
  const allStudyIds = roots.flatMap((r) => r.studyIds)

  const titleEntries = await Promise.all(
    allStudyIds.map(async (id): Promise<[string, string] | null> => {
      const study = await window.chessoc.moveTree.getOpeningStudy(id)
      return study ? [id, study.title] : null
    })
  )

  const studyTitles = new Map(titleEntries.filter((e): e is [string, string] => e !== null))
  return buildSunburstCenters(ensureAllPieceTypeRoots(roots), studyTitles)
}

export function HomePage({ onOpenSubject, onOpenLibrary, onOpenAnalysis }: HomePageProps): React.JSX.Element {
  const [centers, setCenters] = useState<SunburstCenterData[]>([])
  const [loading, setLoading] = useState(true)

  const [creatingPieceType, setCreatingPieceType] = useState<OpeningPieceType | null>(null)
  const [newStudyTitle, setNewStudyTitle] = useState('')

  // 每次挂载都重新拉取一遍（比如从棋路详情页返回首页时，App.tsx整个换掉了组件实例，
  // HomePage会重新mount，这个effect自然会重新跑一次，径向图会带上刚打的谱重新渲染）。
  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      const result = await loadSunburstCenters()
      if (cancelled) return
      setCenters(result)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleConfirmCreateStudy(): Promise<void> {
    if (!creatingPieceType) return
    const title = newStudyTitle.trim()
    if (!title) return
    const study = await window.chessoc.moveTree.createOpeningStudy({ pieceType: creatingPieceType, title })
    setCreatingPieceType(null)
    setNewStudyTitle('')
    onOpenSubject({ kind: 'opening', id: study.id })
  }

  return (
    <div className="home-page">
      <h1>ChessOC 打谱助手</h1>

      <section className="home-section">
        <h2>开局径向图</h2>
        <p className="home-empty-hint">
          点中心的棋子图标新建一条棋路；点已创建棋路对应的小球，直接进入继续打谱。
        </p>
        {loading ? (
          <p>加载中…</p>
        ) : (
          <OpeningSunburst
            centers={centers}
            onEnterStudy={(studyId) => onOpenSubject({ kind: 'opening', id: studyId })}
            onCreateStudy={(pieceType) => {
              setCreatingPieceType(pieceType)
              setNewStudyTitle('')
            }}
          />
        )}
      </section>

      <section className="home-section">
        <h2>中局 / 残局案例</h2>
        <p className="home-empty-hint">案例支持分文件夹管理和按标题搜索，统一放在案例库页面里。</p>
        <button className="home-library-link" onClick={onOpenLibrary}>
          打开中局 / 残局案例库 →
        </button>
      </section>

      <section className="home-section">
        <h2>AI 分析</h2>
        <p className="home-empty-hint">摆一个局面单次分析，或者把一整局走出来看胜率走势。</p>
        <button className="home-library-link" onClick={onOpenAnalysis}>
          打开 AI 分析 →
        </button>
      </section>

      {creatingPieceType && (
        <>
          <div className="confirm-dialog-overlay" onClick={() => setCreatingPieceType(null)} />
          <div className="confirm-dialog">
            <p className="confirm-dialog-message">新建一条「{OPENING_CENTER_LABELS[creatingPieceType]}」棋路，请输入谱名：</p>
            <input
              autoFocus
              type="text"
              placeholder="比如「中炮对屏风马」"
              value={newStudyTitle}
              onChange={(e) => setNewStudyTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreateStudy()
              }}
            />
            <div className="confirm-dialog-actions">
              <button onClick={() => setCreatingPieceType(null)}>取消</button>
              <button
                className="confirm-dialog-danger"
                onClick={handleConfirmCreateStudy}
                disabled={!newStudyTitle.trim()}
              >
                创建并进入
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
