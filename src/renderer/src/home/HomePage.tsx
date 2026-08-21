// 首页：新建/打开一条开局棋路，或新建/打开一个中局/残局案例。
// 阶段4之前(App.tsx)默认直接进阶段2的孤立棋盘demo；现在换成这个首页作为真正的入口，
// 阶段2的demo(PlayGroundPage.tsx)代码还留着，只是不再是默认页面了。

import { useEffect, useState } from 'react'
import type { OpeningPieceType, OpeningStudy } from '@shared/moveTree'
import type { StudySubjectRef } from '../study/useStudySession'

interface HomePageProps {
  onOpenSubject: (ref: StudySubjectRef) => void
  onOpenLibrary: () => void
}

const PIECE_TYPE_LABELS: Record<OpeningPieceType, string> = {
  C: '炮',
  N: '马',
  B: '象/相',
  R: '车',
  P: '兵/卒'
}

export function HomePage({ onOpenSubject, onOpenLibrary }: HomePageProps): React.JSX.Element {
  const [studies, setStudies] = useState<OpeningStudy[]>([])
  const [loading, setLoading] = useState(true)

  const [newStudyTitle, setNewStudyTitle] = useState('')
  const [newStudyPieceType, setNewStudyPieceType] = useState<OpeningPieceType>('C')

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      const studyList = await window.chessoc.moveTree.listOpeningStudies()
      if (cancelled) return
      setStudies(studyList)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleCreateStudy(): Promise<void> {
    const title = newStudyTitle.trim()
    if (!title) return
    const study = await window.chessoc.moveTree.createOpeningStudy({ pieceType: newStudyPieceType, title })
    setNewStudyTitle('')
    onOpenSubject({ kind: 'opening', id: study.id })
  }

  return (
    <div className="home-page">
      <h1>ChessOC 打谱助手</h1>

      <section className="home-section">
        <h2>开局棋路</h2>
        <div className="home-create-form">
          <select value={newStudyPieceType} onChange={(e) => setNewStudyPieceType(e.target.value as OpeningPieceType)}>
            {Object.entries(PIECE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="给这条棋路起个名字，比如「中炮对屏风马」"
            value={newStudyTitle}
            onChange={(e) => setNewStudyTitle(e.target.value)}
          />
          <button onClick={handleCreateStudy} disabled={!newStudyTitle.trim()}>
            新建开局棋路
          </button>
        </div>
        {loading ? (
          <p>加载中…</p>
        ) : studies.length === 0 ? (
          <p className="home-empty-hint">还没有开局棋路，创建一条开始打谱吧。</p>
        ) : (
          <ul className="home-list">
            {studies.map((study) => (
              <li key={study.id}>
                <button className="home-list-item" onClick={() => onOpenSubject({ kind: 'opening', id: study.id })}>
                  【{PIECE_TYPE_LABELS[study.pieceType]}】{study.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="home-section">
        <h2>中局 / 残局案例</h2>
        <p className="home-empty-hint">案例支持分文件夹管理和按标题搜索，统一放在案例库页面里。</p>
        <button className="home-library-link" onClick={onOpenLibrary}>
          打开中局 / 残局案例库 →
        </button>
      </section>
    </div>
  )
}
