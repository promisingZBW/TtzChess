import { useState } from 'react'
import { AnalysisHomePage } from './analysis/AnalysisHomePage'
import { FullGameAnalysisPage } from './analysis/FullGameAnalysisPage'
import { SinglePositionAnalysisPage } from './analysis/SinglePositionAnalysisPage'
import { HomePage } from './home/HomePage'
import { CaseLibraryPage } from './library/CaseLibraryPage'
import { StudyDetailPage } from './study/StudyDetailPage'
import type { StudySubjectRef } from './study/useStudySession'

type View =
  | { kind: 'home' }
  | { kind: 'library' }
  | { kind: 'detail'; subjectRef: StudySubjectRef }
  | { kind: 'analysisHome' }
  | { kind: 'analysisSingle' }
  | { kind: 'analysisFullGame' }

function App(): React.JSX.Element {
  const [view, setView] = useState<View>({ kind: 'home' })

  if (view.kind === 'detail') {
    return <StudyDetailPage subjectRef={view.subjectRef} onBack={() => setView({ kind: 'home' })} />
  }

  if (view.kind === 'library') {
    return (
      <CaseLibraryPage
        onOpenCase={(ref) => setView({ kind: 'detail', subjectRef: ref })}
        onBack={() => setView({ kind: 'home' })}
      />
    )
  }

  if (view.kind === 'analysisSingle') {
    return <SinglePositionAnalysisPage onBack={() => setView({ kind: 'analysisHome' })} />
  }

  if (view.kind === 'analysisFullGame') {
    return <FullGameAnalysisPage onBack={() => setView({ kind: 'analysisHome' })} />
  }

  if (view.kind === 'analysisHome') {
    return (
      <AnalysisHomePage
        onBack={() => setView({ kind: 'home' })}
        onOpenSingleAnalysis={() => setView({ kind: 'analysisSingle' })}
        onOpenFullGameAnalysis={() => setView({ kind: 'analysisFullGame' })}
      />
    )
  }

  return (
    <HomePage
      onOpenSubject={(ref) => setView({ kind: 'detail', subjectRef: ref })}
      onOpenLibrary={() => setView({ kind: 'library' })}
      onOpenAnalysis={() => setView({ kind: 'analysisHome' })}
    />
  )
}

export default App
