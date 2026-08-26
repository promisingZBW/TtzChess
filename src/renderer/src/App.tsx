import { useState } from 'react'
import { FullGameAnalysisPage } from './analysis/FullGameAnalysisPage'
import { SinglePositionAnalysisPage } from './analysis/SinglePositionAnalysisPage'
import { HomePage, type HomeTab } from './home/HomePage'
import { StudyDetailPage } from './study/StudyDetailPage'
import { TitleBar } from './TitleBar'
import type { StudySubjectRef } from './study/useStudySession'

type View =
  | { kind: 'home' }
  | { kind: 'detail'; subjectRef: StudySubjectRef }
  | { kind: 'analysisSingle' }
  | { kind: 'analysisFullGame' }

function App(): React.JSX.Element {
  const [view, setView] = useState<View>({ kind: 'home' })
  const [homeTab, setHomeTab] = useState<HomeTab>('opening')

  let page: React.JSX.Element
  if (view.kind === 'detail') {
    page = <StudyDetailPage subjectRef={view.subjectRef} onBack={() => setView({ kind: 'home' })} />
  } else if (view.kind === 'analysisSingle') {
    page = (
      <SinglePositionAnalysisPage
        onBack={() => {
          setHomeTab('analysis')
          setView({ kind: 'home' })
        }}
      />
    )
  } else if (view.kind === 'analysisFullGame') {
    page = (
      <FullGameAnalysisPage
        onBack={() => {
          setHomeTab('analysis')
          setView({ kind: 'home' })
        }}
      />
    )
  } else {
    page = (
      <HomePage
        activeTab={homeTab}
        onTabChange={setHomeTab}
        onOpenSubject={(ref) => setView({ kind: 'detail', subjectRef: ref })}
        onOpenSingleAnalysis={() => setView({ kind: 'analysisSingle' })}
        onOpenFullGameAnalysis={() => setView({ kind: 'analysisFullGame' })}
      />
    )
  }

  // 整窗用一列弹性布局：标题栏固定 36px，下面页面吃掉剩余高度。
  // 打谱页之前写了 height:100vh，会从窗口最顶端算起，把保存/沙盘顶到和系统三个按钮同一行。
  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-shell-page">{page}</div>
    </div>
  )
}

export default App
