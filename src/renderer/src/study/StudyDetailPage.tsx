// 打谱详情界面（dev guide 第5节）：左边棋盘 + 顶部工具栏（返回/保存/沙盘） + 棋盘下方前进后退，
// 右边光球棋谱树面板。摆局阶段（案例专属）额外多一列棋子摆放区和"开始打谱"按钮。
// 这个文件只负责"组装+布局"，具体状态逻辑都在 useStudySession，交互细节在子组件里。

import type { Piece, Position } from '@shared/chess'
import { BoardView } from '../board/BoardView'
import type { PieceDragPayload } from './dragTypes'
import { MoveTreePanel } from './MoveTreePanel'
import { PlacementTray } from './PlacementTray'
import { PlacementGhost } from './PlacementGhost'
import { useKeyboardPlacement } from './useKeyboardPlacement'
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

export function StudyDetailPage({ subjectRef, onBack }: StudyDetailPageProps): React.JSX.Element {
  const session = useStudySession(subjectRef)
  const keyboard = useKeyboardPlacement(session.mode === 'placing')

  function handleDropPiece(pos: Position, payload: PieceDragPayload): void {
    if (payload.fromBoard) {
      if (payload.fromBoard.row === pos.row && payload.fromBoard.col === pos.col) return
      session.removePlacedPiece(payload.fromBoard)
    }
    const piece: Piece = { kind: payload.kind, side: payload.side }
    session.placePiece(pos, piece)
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

  return (
    <div className="study-detail-page">
      <header className="study-toolbar">
        <button className="study-toolbar-back" onClick={onBack}>
          ← 返回首页
        </button>
        <h2 className="study-title">{session.subject.title}</h2>
        <div className="study-toolbar-right">
          <button onClick={session.save} disabled={session.saveStatus === 'saving'}>
            {SAVE_BUTTON_LABEL[session.saveStatus]}
          </button>
          <button
            className={session.isSandbox ? 'sandbox-toggle sandbox-toggle-active' : 'sandbox-toggle'}
            onClick={session.toggleSandbox}
            disabled={session.mode === 'placing'}
            title="开启后随便走几步看看，关闭会自动回到进入前的局面，不会记录进正式棋谱"
          >
            {session.isSandbox ? '退出沙盘演练' : '沙盘演练模式'}
          </button>
        </div>
      </header>

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
            />
            {session.mode === 'placing' && keyboard.heldPiece && (
              <PlacementGhost piece={keyboard.heldPiece} pointer={keyboard.pointer} />
            )}

            {session.mode === 'placing' && (
              <button className="start-recording-button" onClick={session.startRecording}>
                开始打谱
              </button>
            )}

            <div className="study-nav-buttons">
              <button onClick={session.goBack} disabled={!session.canGoBack}>
                ← 后退
              </button>
              <button onClick={session.goForward} disabled={!session.canGoForward}>
                前进 →
              </button>
            </div>
          </div>
        </div>

        {session.mode === 'recording' && session.rootNodeId && (
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
      </div>
    </div>
  )
}
