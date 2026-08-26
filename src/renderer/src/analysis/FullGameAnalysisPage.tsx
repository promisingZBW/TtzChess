// 整局分析页面（dev guide 7.2节）：选红/黑视角 -> 从标准开局开始，自己一步步把真实棋谱走出来，
// 每走一步同步更新右侧胜率折线图；折线图上的点可以点回去看历史局面；在任意历史点还能
// 额外触发一次完整的"单次分析"（复用7.1的PV步进逻辑和展示格式）。
// 沙盘演练只改眼前的棋，不进折线图；一键收藏会把到目前为止的正式棋路存进「整局」案例库。

import { useEffect, useState } from 'react'
import type { Side } from '@shared/chess'
import type { Folder } from '@shared/moveTree'
import { BoardView } from '../board/BoardView'
import { EngineStatusBanner } from './EngineStatusBanner'
import { SingleAnalysisResultsPanel } from './SingleAnalysisResultsPanel'
import { collectFullGameToLibrary } from './collectFullGame'
import { runSinglePositionAnalysis, type SingleAnalysisResult } from './singlePositionAnalysis'
import { useEngineStatus } from './useEngineStatus'
import { useFullGameAnalysis } from './useFullGameAnalysis'
import { WinRateChart } from './WinRateChart'
import { WinRateValue } from './WinRateValue'

interface FullGameAnalysisPageProps {
  onBack: () => void
}

interface DeepAnalysisState {
  status: 'idle' | 'loading' | 'done' | 'error'
  result: SingleAnalysisResult | null
  error: string | null
}

const SIDE_LABEL: Record<Side, string> = { red: '红方', black: '黑方' }
const DEEP_ANALYSIS_IDLE: DeepAnalysisState = { status: 'idle', result: null, error: null }

function folderPathLabel(folderId: string | null, allFolders: Folder[]): string {
  if (folderId === null) return '未分类'
  const names: string[] = []
  let current = allFolders.find((f) => f.id === folderId)
  while (current) {
    names.unshift(current.name)
    const parentId = current.parentFolderId
    current = parentId ? allFolders.find((f) => f.id === parentId) : undefined
  }
  return names.length > 0 ? names.join(' / ') : '未分类'
}

export function FullGameAnalysisPage({ onBack }: FullGameAnalysisPageProps): React.JSX.Element {
  const session = useFullGameAnalysis()
  const engineStatus = useEngineStatus()
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysisState>(DEEP_ANALYSIS_IDLE)
  const [collectOpen, setCollectOpen] = useState(false)
  const [collectTitle, setCollectTitle] = useState('')
  const [collectFolderId, setCollectFolderId] = useState('')
  const [folders, setFolders] = useState<Folder[]>([])
  const [collectStatus, setCollectStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [collectError, setCollectError] = useState<string | null>(null)

  useEffect(() => {
    if (!collectOpen) return
    let cancelled = false
    window.chessoc.moveTree.listAllFolders().then((list) => {
      if (!cancelled) setFolders(list)
    })
    return () => {
      cancelled = true
    }
  }, [collectOpen])

  async function handleDeepAnalyzeViewing(): Promise<void> {
    setDeepAnalysis({ status: 'loading', result: null, error: null })
    try {
      const result = await runSinglePositionAnalysis(
        session.board,
        session.sideToMove,
        window.chessoc.engine.analyzePosition
      )
      setDeepAnalysis({ status: 'done', result, error: null })
    } catch (err) {
      setDeepAnalysis({ status: 'error', result: null, error: err instanceof Error ? err.message : String(err) })
    }
  }

  function handleSelectIndex(index: number): void {
    if (session.isSandbox) return
    session.jumpToIndex(index)
    setDeepAnalysis(DEEP_ANALYSIS_IDLE)
  }

  function openCollectDialog(): void {
    setCollectTitle('')
    setCollectFolderId('')
    setCollectStatus('idle')
    setCollectError(null)
    setCollectOpen(true)
  }

  async function handleConfirmCollect(): Promise<void> {
    const title = collectTitle.trim()
    if (!title) return
    setCollectStatus('saving')
    setCollectError(null)
    try {
      await collectFullGameToLibrary(session.history, title, collectFolderId === '' ? null : collectFolderId)
      setCollectStatus('saved')
      setCollectOpen(false)
      setTimeout(() => setCollectStatus('idle'), 2000)
    } catch (err) {
      setCollectStatus('error')
      setCollectError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!session.started) {
    return (
      <div className="study-detail-page">
        <header className="study-toolbar">
          <button className="study-toolbar-back" onClick={onBack}>
            ← 返回
          </button>
          <h2 className="study-title">整局分析</h2>
        </header>
        <div className="analysis-setup">
          <p>选择你要跟踪哪一方的胜率视角，然后从标准开局开始，把这一整局真实棋谱走出来。</p>
          <div className="analysis-controls">
            <label className="analysis-side-radio">
              <input
                type="radio"
                name="perspective"
                checked={session.perspective === 'red'}
                onChange={() => session.setPerspective('red')}
              />
              红方视角
            </label>
            <label className="analysis-side-radio">
              <input
                type="radio"
                name="perspective"
                checked={session.perspective === 'black'}
                onChange={() => session.setPerspective('black')}
              />
              黑方视角
            </label>
            <button className="analysis-start-button" onClick={session.start}>
              开始复盘
            </button>
          </div>
        </div>
      </div>
    )
  }

  const viewingEntry = session.viewingEntry

  if (!viewingEntry) {
    return <div className="study-status-page">正在初始化棋局…</div>
  }

  return (
    <div className="study-detail-page">
      <header className="study-toolbar">
        <button className="study-toolbar-back" onClick={onBack}>
          ← 返回
        </button>
        <h2 className="study-title">整局分析（{SIDE_LABEL[session.perspective]}视角）</h2>
        <div className="study-toolbar-right">
          <button
            className={session.isSandbox ? 'sandbox-toggle sandbox-toggle-active' : 'sandbox-toggle'}
            onClick={session.toggleSandbox}
            title="开启后随便走走看，关闭会回到进入前的局面，不会记进这局棋谱"
          >
            {session.isSandbox ? '退出沙盘演练' : '沙盘演练模式'}
          </button>
          <button onClick={openCollectDialog} disabled={collectStatus === 'saving'}>
            {collectStatus === 'saved' ? '已收藏 ✓' : collectStatus === 'saving' ? '收藏中…' : '收藏到整局案例库'}
          </button>
        </div>
      </header>

      <EngineStatusBanner status={engineStatus} />

      <div className="study-body analysis-split-body">
        <div className="study-board-column">
          <div className="study-board-center">
            {session.isSandbox && (
              <p className="study-hint study-hint-sandbox">沙盘演练中：这里的走法不会记进胜率走势，关闭后棋盘回到进入前的局面</p>
            )}
            {!session.isSandbox && !session.isAtLatest && (
              <p className="analysis-hint">正在查看第{session.viewingIndex}步的历史局面，此时无法继续走棋。</p>
            )}
            <BoardView
              board={session.board}
              selected={session.selection.selected}
              legalTargets={session.selection.legalTargets}
              onSquareClick={session.handleSquareClick}
            />
            <div className="analysis-controls">
              <button onClick={session.undoLastMove} disabled={!session.canUndo}>
                撤回上一步
              </button>
              {!session.isAtLatest && !session.isSandbox && (
                <button onClick={session.backToLatest}>回到最新局面，继续走棋</button>
              )}
              <button onClick={handleDeepAnalyzeViewing} disabled={deepAnalysis.status === 'loading'}>
                {deepAnalysis.status === 'loading' ? '分析中…' : '对当前局面做单次分析'}
              </button>
            </div>
          </div>
        </div>

        <div className="analysis-panel-column">
          <div className="analysis-chart-block">
            <h3>胜率走势</h3>
            <WinRateChart history={session.history} viewingIndex={session.viewingIndex} onSelectIndex={handleSelectIndex} />
            <p className="analysis-hint">
              {viewingEntry.moveNotation ? `第${session.viewingIndex}步：${viewingEntry.moveNotation}` : '起始局面'}
              {viewingEntry.wdl ? (
                <>
                  {' '}
                  胜率：
                  <WinRateValue
                    wdl={viewingEntry.wdl}
                    wdlSide={viewingEntry.sideToMove}
                    perspective={session.perspective}
                  />
                </>
              ) : typeof viewingEntry.winRatePercent === 'number' ? (
                ` 胜率：${viewingEntry.winRatePercent}%`
              ) : viewingEntry.winRatePercent === undefined ? (
                ' 胜率计算中…'
              ) : (
                ' 胜率查询失败'
              )}
            </p>
          </div>

          {deepAnalysis.status !== 'idle' && (
            <div className="analysis-deep-panel">
              <h3>单次分析结果</h3>
              <SingleAnalysisResultsPanel
                status={deepAnalysis.status}
                result={deepAnalysis.result}
                error={deepAnalysis.error}
              />
            </div>
          )}
        </div>
      </div>

      {collectOpen && (
        <>
          <div className="confirm-dialog-overlay" onClick={() => setCollectOpen(false)} />
          <div className="confirm-dialog">
            <p className="confirm-dialog-message">
              把到目前为止走出的棋路收藏进整局案例库。之后可以在「中局 / 残局 / 整局」里继续打谱或整理文件夹。
            </p>
            <input
              autoFocus
              type="text"
              placeholder="给这一局起个名字"
              value={collectTitle}
              onChange={(e) => setCollectTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleConfirmCollect()
              }}
            />
            <select value={collectFolderId} onChange={(e) => setCollectFolderId(e.target.value)}>
              <option value="">未分类（先放在案例库根目录）</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folderPathLabel(folder.id, folders)}
                </option>
              ))}
            </select>
            {collectError && <p className="analysis-hint analysis-hint-error">{collectError}</p>}
            <div className="confirm-dialog-actions">
              <button onClick={() => setCollectOpen(false)}>取消</button>
              <button
                className="analysis-start-button"
                onClick={() => void handleConfirmCollect()}
                disabled={!collectTitle.trim() || collectStatus === 'saving'}
              >
                {collectStatus === 'saving' ? '收藏中…' : '确认收藏'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
