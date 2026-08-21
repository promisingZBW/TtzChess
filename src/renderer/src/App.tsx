import { useState } from 'react'
import { HomePage } from './home/HomePage'
import { CaseLibraryPage } from './library/CaseLibraryPage'
import { StudyDetailPage } from './study/StudyDetailPage'
import type { StudySubjectRef } from './study/useStudySession'

type View = { kind: 'home' } | { kind: 'library' } | { kind: 'detail'; subjectRef: StudySubjectRef }

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

  return (
    <HomePage
      onOpenSubject={(ref) => setView({ kind: 'detail', subjectRef: ref })}
      onOpenLibrary={() => setView({ kind: 'library' })}
    />
  )
}

export default App
