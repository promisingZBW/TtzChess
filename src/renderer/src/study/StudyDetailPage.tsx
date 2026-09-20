// 打谱详情界面（dev guide 第5节）：左边棋盘 + 顶部工具栏（返回/保存/AI分析/沙盘） + 棋盘下方前进后退，
// 右边光球棋谱树面板。摆局阶段（案例专属）额外多一列棋子摆放区和"开始打谱"按钮。
// 这个文件只负责"组装+布局"，具体状态逻辑都在 useStudySession，交互细节在子组件里。
//
// 右侧那一列是"棋谱树"和"AI分析"两个标签页轮流占用的，像浏览器切标签页一样——窗口宽度就这么多，
// 再横着塞一列分析结果棋盘就没地方放了，所以点AI分析时直接把棋谱树盖住，随时可以切回去。

import { useState } from 'react'
import { boardToFen, winnerFromBoard } from '@shared/chess'
import type { Piece, Position, Side } from '@shared/chess'
import { SoundToggleButton } from '../audio/SoundToggleButton'
import { BoardAnalysisPanel } from '../analysis/BoardAnalysisPanel'
import { usePositionAnalysis } from '../analysis/usePositionAnalysis'
import { BoardView } from '../board/BoardView'
import type { PieceDragPayload } from './dragTypes'
import { MoveTreePanel } from './MoveTreePanel'
import { PlacementTray } from './PlacementTray'
import { PlacementGhost } from './PlacementGhost'
import { useKeyboardPlacement } from './useKeyboardPlacement'
import { renderMoveTreeSvg, svgToPngBase64 } from './exportMoveTreeSvg'
import { useStudySession, type StudySubjectRef } from './useStudySession'

interface StudyDetailPageProps {
  subjectRef: StudySubjectRef
  onBack: () => void
}

const SAVE_BUTTON_LABEL: Record<'idle' | 'saving' | 'saved', string> = {
  idle: '保存',
  saving: '保存中…',
  saved: '已保存 ✓'
}

type RightPane = 'tree' | 'analysis'

const WINNER_LABEL: Record<Side, string> = { red: '红方胜利', black: '黑方胜利' }

/** Windows 文件名里不能出现的那几个字符，用谱名当默认文件名之前先洗一遍 */
const FORBIDDEN_FILENAME_CHARS = '\\/:*?"<>|'

function toSafeFileName(title: string): string {
  const cleaned = [...title].map((ch) => (FORBIDDEN_FILENAME_CHARS.includes(ch) ? '_' : ch)).join('')
  return cleaned.trim() || '棋谱树'
}

export function StudyDetailPage({ subjectRef, onBack }: StudyDetailPageProps): React.JSX.Element {
  const session = useStudySession(subjectRef)
  const keyboard = useKeyboardPlacement(session.mode === 'placing')
  const analysis = usePositionAnalysis()

  // analysisOpen 决定"AI分析"这个标签页存不存在，rightPane 决定现在显示哪个标签页。
  // 分开两个状态，是为了让用户切回棋谱树看一眼再切回来时，分析结果还在（不用重新等引擎）。
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [rightPane, setRightPane] = useState<RightPane>('tree')
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [exportHint, setExportHint] = useState<string | null>(null)

  function handleDropPiece(pos: Position, payload: PieceDragPayload): void {
    if (payload.fromBoard) {
      if (payload.fromBoard.row === pos.row && payload.fromBoard.col === pos.col) return
      session.removePlacedPiece(payload.fromBoard)
    }
    const piece: Piece = { kind: payload.kind, side: payload.side }
    session.placePiece(pos, piece)
  }

  function handleAnalyze(): void {
    setAnalysisOpen(true)
    setRightPane('analysis')
    void analysis.analyze(session.board, session.sideToMove)
  }

  function handleCloseAnalysis(): void {
    setAnalysisOpen(false)
    setRightPane('tree')
    analysis.reset()
  }

  /** 把当前棋谱树导出成 PNG。只有开局棋路给这个入口——案例库那边的树通常就几步，没必要 */
  async function handleExportTree(): Promise<void> {
    if (!session.rootNodeId || !session.subject) return
    setExportHint(null)
    try {
      const rendered = renderMoveTreeSvg(session.nodes, session.rootNodeId, session.subject.title)
      if (!rendered) {
        setExportHint('棋谱树还是空的，先走几步再导出。')
        return
      }
      const base64 = await svgToPngBase64(rendered)
      const result = await window.chessoc.exporter.savePngImage(
        `${toSafeFileName(session.subject.title)}.png`,
        base64
      )
      if (result.saved) setExportHint('棋谱树已保存 ✓')
    } catch (err) {
      setExportHint(`导出失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function handleRestartPlacement(): void {
    if (session.restartPlacementDropsMoves) {
      setConfirmRestart(true)
      return
    }
    void session.restartPlacement()
  }

  if (session.loading) {
    return <div className="study-status-page">正在加载棋谱…</div>
  }

  if (session.error || !session.subject) {
    return (
      <div className="study-status-page study-status-error">
        <p>{session.error ?? '未知错误'}</p>
        <button onClick={onBack}>返回首页</button>
      </div>
    )
  }

  const hasPieces = session.board.some((row) => row.some((square) => square !== null))
  const treeAvailable = session.mode === 'recording' && session.rootNodeId !== null
  // 摆局阶段棋盘上本来就可能只有一个将，那不叫分出胜负，所以只在打谱阶段看
  const winner = session.mode === 'recording' ? winnerFromBoard(session.board) : null
  const isOpening = session.subject.kind === 'opening'
  const showTreePane = rightPane === 'tree' && treeAvailable
  const showAnalysisPane = rightPane === 'analysis' && analysisOpen

  return (
    <div className="study-detail-page">
      <header className="study-toolbar">
        <button className="study-toolbar-back" onClick={onBack}>
          ← 返回首页
        </button>
        <h2 className="study-title">{session.subject.title}</h2>
        {winner && <span className={`study-winner-badge study-winner-${winner}`}>{WINNER_LABEL[winner]}</span>}
        <div className="study-toolbar-right">
          <button onClick={session.save} disabled={session.saveStatus === 'saving'}>
            {SAVE_BUTTON_LABEL[session.saveStatus]}
          </button>
          {isOpening && (
            <button onClick={handleExportTree} title="把右边这棵棋谱树存成一张图片">
              输出棋谱树
            </button>
          )}
          <button
            className={flipped ? 'flip-toggle flip-toggle-active' : 'flip-toggle'}
            onClick={() => setFlipped((prev) => !prev)}
            title="红黑视角对调，棋盘和两侧路数一起翻转"
          >
            反转视角
          </button>
          <button
            className={showAnalysisPane ? 'analysis-toggle analysis-toggle-active' : 'analysis-toggle'}
            onClick={handleAnalyze}
            disabled={!hasPieces || analysis.status === 'loading'}
            title="用当前棋盘上的局面直接做一次AI分析，不用另外再摆一遍"
          >
            {analysis.status === 'loading' ? 'AI 分析中…' : 'AI 分析'}
          </button>
          <button
            className={session.isSandbox ? 'sandbox-toggle sandbox-toggle-active' : 'sandbox-toggle'}
            onClick={session.toggleSandbox}
            disabled={session.mode === 'placing'}
            title="开启后随便走几步看看，关闭会自动回到进入前的局面，不会记录进正式棋谱"
          >
            {session.isSandbox ? '退出沙盘演练' : '沙盘演练模式'}
          </button>
          <SoundToggleButton />
        </div>
      </header>
      {exportHint && <p className="study-export-hint">{exportHint}</p>}

      <div className="study-body">
        <div className="study-board-column">
          {session.mode === 'placing' && (
            <PlacementTray
              onRemoveFromBoard={session.removePlacedPiece}
              heldPiece={keyboard.heldPiece}
              onSelectPiece={keyboard.setHeldPiece}
            />
          )}

          <div className="study-board-center">
            {session.isSandbox && (
              <p className="study-hint study-hint-sandbox">沙盘演练中：这里的走法不会被保存到棋谱树</p>
            )}

            <BoardView
              board={session.board}
              selected={session.selection.selected}
              legalTargets={session.selection.legalTargets}
              onSquareClick={
                session.mode === 'recording'
                  ? session.handleSquareClick
                  : keyboard.heldPiece
                    ? (pos) => session.placePiece(pos, keyboard.heldPiece as Piece)
                    : undefined
              }
              placement={
                session.mode === 'placing'
                  ? { onDropPiece: handleDropPiece, onRemovePiece: session.removePlacedPiece }
                  : undefined
              }
              flipped={flipped}
            />
            {session.mode === 'placing' && keyboard.heldPiece && (
              <PlacementGhost piece={keyboard.heldPiece} pointer={keyboard.pointer} />
            )}

            {session.mode === 'placing' && (
              <button className="start-recording-button" onClick={session.startRecording}>
                开始打谱
              </button>
            )}

            {session.canRestartPlacement && (
              <button
                className="restart-placement-button"
                onClick={handleRestartPlacement}
                title="回到摆局界面改这个案例的起始局面"
              >
                重新摆局
              </button>
            )}

            {/* 沙盘里走的是沙盘自己那条历史，退到底就回到进沙盘时的局面；
                正式打谱时走的是棋谱树。两套历史互不干扰，所以按钮共用一排就行 */}
            <div className="study-nav-buttons">
              <button
                onClick={session.isSandbox ? session.sandboxBack : session.goBack}
                disabled={session.isSandbox ? !session.canSandboxBack : !session.canGoBack}
              >
                ← 后退
              </button>
              <button
                onClick={session.isSandbox ? session.sandboxForward : session.goForward}
                disabled={session.isSandbox ? !session.canSandboxForward : !session.canGoForward}
              >
                前进 →
              </button>
            </div>
          </div>
        </div>

        {(showTreePane || showAnalysisPane) && (
          <div className="study-right-column">
            {analysisOpen && (
              <div className="study-pane-tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={rightPane === 'tree'}
                  className={rightPane === 'tree' ? 'study-pane-tab study-pane-tab-active' : 'study-pane-tab'}
                  onClick={() => setRightPane('tree')}
                  disabled={!treeAvailable}
                  title={treeAvailable ? undefined : '摆局阶段还没有棋谱树，点"开始打谱"之后才会有'}
                >
                  棋谱树
                </button>
                <button
                  role="tab"
                  aria-selected={rightPane === 'analysis'}
                  className={
                    rightPane === 'analysis' ? 'study-pane-tab study-pane-tab-active' : 'study-pane-tab'
                  }
                  onClick={() => setRightPane('analysis')}
                >
                  AI 分析
                </button>
              </div>
            )}

            {showTreePane && session.rootNodeId && (
              <MoveTreePanel
                nodes={session.nodes}
                rootNodeId={session.rootNodeId}
                currentNodeId={session.currentNodeId}
                activePath={session.activePath}
                onJumpToNode={session.jumpToNode}
                onDeleteNode={session.deleteNode}
                onSetNote={session.setNoteText}
              />
            )}

            {showAnalysisPane && (
              <BoardAnalysisPanel
                analysis={analysis}
                currentFen={boardToFen(session.board, session.sideToMove)}
                sideToMove={session.sideToMove}
                isSandbox={session.isSandbox}
                onAnalyze={handleAnalyze}
                onClose={handleCloseAnalysis}
              />
            )}
          </div>
        )}
      </div>

      {confirmRestart && (
        <>
          <div className="confirm-dialog-overlay" onClick={() => setConfirmRestart(false)} />
          <div className="confirm-dialog">
            <p className="confirm-dialog-message">
              重新摆局会回到摆局界面，让你改这个案例的起始局面。已经记下来的走法是在旧的起始局面上一步步推出来的，
              换了起始局面就对不上了，所以会被一起清掉。确定要重新摆局吗？
            </p>
            <div className="confirm-dialog-actions">
              <button onClick={() => setConfirmRestart(false)}>取消</button>
              <button
                className="confirm-dialog-danger"
                onClick={() => {
                  setConfirmRestart(false)
                  handleCloseAnalysis()
                  void session.restartPlacement()
                }}
              >
                确认重新摆局
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
