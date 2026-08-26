// 首页：左侧三个功能栏，右侧显示对应内容。默认打开开局径向图。
// 中局/残局案例库和 AI 分析入口都嵌在右侧，不再跳到单独的整页，避免首页被撑出滚动条。

import { useEffect, useState } from 'react'
import type { OpeningPieceType, OpeningRoot } from '@shared/moveTree'
import type { StudySubjectRef } from '../study/useStudySession'
import { AnalysisHomePage } from '../analysis/AnalysisHomePage'
import { CaseLibraryPage } from '../library/CaseLibraryPage'
import { buildSunburstCenters, ensureAllPieceTypeRoots, OPENING_CENTER_LABELS } from './openingSunburstUtils'
import type { SunburstCenterData } from './openingSunburstUtils'
import { OpeningSunburst } from './OpeningSunburst'

export type HomeTab = 'opening' | 'library' | 'analysis'

interface HomePageProps {
  activeTab: HomeTab
  onTabChange: (tab: HomeTab) => void
  onOpenSubject: (ref: StudySubjectRef) => void
  onOpenSingleAnalysis: () => void
  onOpenFullGameAnalysis: () => void
}

const TABS: Array<{ id: HomeTab; label: string; hint: string }> = [
  { id: 'opening', label: '开局径向图', hint: '按起手棋子整理棋路' },
  { id: 'library', label: '中局 / 残局 / 整局', hint: '案例库与文件夹' },
  { id: 'analysis', label: 'AI 分析', hint: '单次分析与整局复盘' }
]

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

export function HomePage({
  activeTab,
  onTabChange,
  onOpenSubject,
  onOpenSingleAnalysis,
  onOpenFullGameAnalysis
}: HomePageProps): React.JSX.Element {
  const [centers, setCenters] = useState<SunburstCenterData[]>([])
  const [loading, setLoading] = useState(true)

  const [creatingPieceType, setCreatingPieceType] = useState<OpeningPieceType | null>(null)
  const [newStudyTitle, setNewStudyTitle] = useState('')

  useEffect(() => {
    if (activeTab !== 'opening') return
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
  }, [activeTab])

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
    <div className="home-workspace">
      <nav className="home-sidebar" aria-label="首页功能">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`home-sidebar-item${activeTab === tab.id ? ' home-sidebar-item-active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="home-sidebar-item-label">{tab.label}</span>
            <span className="home-sidebar-item-hint">{tab.hint}</span>
          </button>
        ))}
      </nav>

      <div className="home-main">
        {activeTab === 'opening' && (
          <section className="home-opening-pane">
            <h1>开局径向图</h1>
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
        )}

        {activeTab === 'library' && (
          <CaseLibraryPage onOpenCase={(ref) => onOpenSubject(ref)} />
        )}

        {activeTab === 'analysis' && (
          <AnalysisHomePage
            onOpenSingleAnalysis={onOpenSingleAnalysis}
            onOpenFullGameAnalysis={onOpenFullGameAnalysis}
          />
        )}
      </div>

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
