// 阶段2要求的"独立页面"：把 BoardView（画棋盘）和 useXiangqiGame（管状态）拼起来，
// 外加一个极简的状态栏和走法记录列表，方便人工验证"能不能完整走完一整局"。
// 明确不做的事（留给后面阶段）：棋谱树、光球图、笔记、存档。

import { useXiangqiGame } from './useXiangqiGame'
import { BoardView } from './BoardView'

const STATUS_LABEL: Record<string, string> = {
  ongoing: '进行中',
  check: '将军！',
  checkmate: '已被将死',
  stalemate: '困毙（无子可走）'
}

function sideLabel(side: 'red' | 'black'): string {
  return side === 'red' ? '红方' : '黑方'
}

export function PlayGroundPage(): React.JSX.Element {
  const game = useXiangqiGame()

  return (
    <div className="playground">
      <h1>阶段 2：最小可用棋盘UI</h1>
      <p className="playground-hint">左键选中己方棋子，再点击目标格移动；不合法的走法会被拒绝并提示。</p>

      <div className="playground-layout">
        <BoardView
          board={game.board}
          selected={game.selected}
          legalTargets={game.legalTargets}
          onSquareClick={game.handleSquareClick}
        />

        <aside className="playground-sidebar">
          <div className="playground-status">
            <p>
              轮到：<strong className={`side-${game.sideToMove}`}>{sideLabel(game.sideToMove)}</strong>
            </p>
            <p>状态：{STATUS_LABEL[game.status]}</p>

            {game.rejectedMessage && <p className="playground-error">{game.rejectedMessage}</p>}

            {game.isGameOver && (
              <p className="playground-result">
                {sideLabel(game.sideToMove)}
                {game.status === 'checkmate' ? '被将死' : '无子可走'}，
                {sideLabel(game.sideToMove === 'red' ? 'black' : 'red')}获胜！
              </p>
            )}

            <button className="counter-button" onClick={game.reset}>
              重新开始
            </button>
          </div>

          <div className="playground-movelog">
            <h2>走法记录</h2>
            {game.moveLog.length === 0 ? (
              <p className="playground-movelog-empty">还没有走子</p>
            ) : (
              <ol>
                {game.moveLog.map((entry, index) => (
                  <li key={index} className={`side-${entry.side}`}>
                    {entry.notation}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
