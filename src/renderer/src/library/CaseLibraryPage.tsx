// 阶段5：中局/终局/整局案例库列表页（dev guide 第6节）。卡片列表 + 按标题搜索 + 文件夹增删改，
// 点击案例卡片直接进入阶段4做好的打谱详情界面。中局/残局从空白棋盘摆局；整局从标准开局起手。
//
// 文件夹用"面包屑路径栈"来表示当前浏览到哪一层：folderPath是从顶层到当前文件夹的完整路径，
// 数组最后一项就是"现在在哪个文件夹里"，点面包屑上的某一段可以直接跳回那一层，逻辑和文件管理器的
// 地址栏一样。搜索的时候忽略文件夹层级，直接全库按标题模糊匹配，这也是大多数文件管理软件的习惯。

import { useEffect, useState } from 'react'
import type { Folder, StudyCase, StudyCaseType } from '@shared/moveTree'
import type { StudySubjectRef } from '../study/useStudySession'

interface CaseLibraryPageProps {
  onOpenCase: (ref: StudySubjectRef) => void
  onBack?: () => void
}

const CASE_TYPE_LABELS: Record<StudyCaseType, string> = {
  midgame: '中局',
  endgame: '残局',
  fullgame: '整局'
}

function formatUpdatedAt(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

/** 从扁平的文件夹列表里，沿parentFolderId往上拼出"上级/上上级/自己"这样的完整路径名 */
function buildFolderPathLabel(folderId: string | null, allFolders: Folder[]): string {
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

export function CaseLibraryPage({ onOpenCase, onBack }: CaseLibraryPageProps): React.JSX.Element {
  const [folderPath, setFolderPath] = useState<Folder[]>([])
  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : null

  const [subfolders, setSubfolders] = useState<Folder[]>([])
  const [allFolders, setAllFolders] = useState<Folder[]>([])
  const [cases, setCases] = useState<StudyCase[]>([])
  const [loading, setLoading] = useState(true)

  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<StudyCase[] | null>(null)

  const [newFolderName, setNewFolderName] = useState('')
  const [newCaseTitle, setNewCaseTitle] = useState('')
  const [newCaseType, setNewCaseType] = useState<StudyCaseType>('midgame')

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null)
  const [editingCaseTitle, setEditingCaseTitle] = useState('')

  // 删除文件夹/案例的二次确认改用自绘的对话框，不用 window.confirm。
  // window.confirm 是浏览器原生的同步阻塞对话框，在 Electron 里有个已知的老毛病：
  // 对话框关闭之后，渲染进程的输入事件（键盘输入、部分点击）会卡住一小段时间才能恢复，
  // 表现出来就是"删完文件夹之后界面卡住，过一会儿才能正常输入/点击"——正好是这次要修的bug。
  const [pendingDelete, setPendingDelete] = useState<{ message: string; onConfirm: () => Promise<void> } | null>(
    null
  )

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      const [subs, all, caseList] = await Promise.all([
        window.chessoc.moveTree.listFolders(currentFolderId),
        window.chessoc.moveTree.listAllFolders(),
        window.chessoc.moveTree.listStudyCasesByFolder(currentFolderId)
      ])
      if (cancelled) return
      setSubfolders(subs)
      setAllFolders(all)
      setCases(caseList)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [currentFolderId])

  useEffect(() => {
    let cancelled = false
    async function search(): Promise<void> {
      const keyword = searchKeyword.trim()
      const results = keyword ? await window.chessoc.moveTree.searchStudyCases(keyword) : null
      if (!cancelled) setSearchResults(results)
    }
    search()
    return () => {
      cancelled = true
    }
  }, [searchKeyword])

  /**
   * 增/删/改之后重新拉取数据，不是放在useEffect里，纯粹是响应用户操作后的手动刷新。
   * 案例的增删改（重命名/移动文件夹/删除）在"搜索结果"视图里也能触发，所以这里要同时
   * 刷新文件夹视图和当前的搜索结果，不然搜索结果那份数据会跟数据库脱节，显示旧内容。
   */
  async function refreshFolderView(): Promise<void> {
    const [subs, all, caseList] = await Promise.all([
      window.chessoc.moveTree.listFolders(currentFolderId),
      window.chessoc.moveTree.listAllFolders(),
      window.chessoc.moveTree.listStudyCasesByFolder(currentFolderId)
    ])
    setSubfolders(subs)
    setAllFolders(all)
    setCases(caseList)

    const keyword = searchKeyword.trim()
    if (keyword) {
      setSearchResults(await window.chessoc.moveTree.searchStudyCases(keyword))
    }
  }

  async function handleCreateFolder(): Promise<void> {
    const name = newFolderName.trim()
    if (!name) return
    await window.chessoc.moveTree.createFolder({ name, parentFolderId: currentFolderId })
    setNewFolderName('')
    await refreshFolderView()
  }

  function startRenameFolder(folder: Folder): void {
    setEditingFolderId(folder.id)
    setEditingFolderName(folder.name)
  }

  async function handleRenameFolderSave(): Promise<void> {
    if (!editingFolderId) return
    const name = editingFolderName.trim()
    if (name) {
      await window.chessoc.moveTree.renameFolder(editingFolderId, name)
    }
    setEditingFolderId(null)
    await refreshFolderView()
  }

  function handleDeleteFolder(folder: Folder): void {
    setPendingDelete({
      message: `删除文件夹「${folder.name}」？里面的子文件夹会变成顶层文件夹，里面的案例会变成未分类，不会被删除。`,
      onConfirm: async () => {
        await window.chessoc.moveTree.deleteFolder(folder.id)
        await refreshFolderView()
      }
    })
  }

  async function handleCreateCase(): Promise<void> {
    const title = newCaseTitle.trim()
    if (!title) return
    const studyCase = await window.chessoc.moveTree.createStudyCase({
      type: newCaseType,
      title,
      folderId: currentFolderId
    })
    setNewCaseTitle('')
    onOpenCase({ kind: 'case', id: studyCase.id })
  }

  function startRenameCase(studyCase: StudyCase): void {
    setEditingCaseId(studyCase.id)
    setEditingCaseTitle(studyCase.title)
  }

  async function handleRenameCaseSave(): Promise<void> {
    if (!editingCaseId) return
    const title = editingCaseTitle.trim()
    if (title) {
      await window.chessoc.moveTree.renameStudyCase(editingCaseId, title)
    }
    setEditingCaseId(null)
    await refreshFolderView()
  }

  function handleDeleteCase(studyCase: StudyCase): void {
    setPendingDelete({
      message: `删除案例「${studyCase.title}」？棋谱树和笔记会一起被删除，此操作不可撤销。`,
      onConfirm: async () => {
        await window.chessoc.moveTree.deleteStudyCase(studyCase.id)
        await refreshFolderView()
      }
    })
  }

  async function confirmPendingDelete(): Promise<void> {
    if (!pendingDelete) return
    const { onConfirm } = pendingDelete
    setPendingDelete(null)
    await onConfirm()
  }

  async function handleMoveCase(studyCase: StudyCase, folderIdValue: string): Promise<void> {
    await window.chessoc.moveTree.moveStudyCaseToFolder(studyCase.id, folderIdValue === '' ? null : folderIdValue)
    await refreshFolderView()
  }

  const isSearching = searchResults !== null
  const displayedCases = searchResults ?? cases

  return (
    <div className="library-page">
      <div className="library-toolbar">
        {onBack && <button onClick={onBack}>← 返回首页</button>}
        <h1 className="library-title">中局 / 残局 / 整局案例库</h1>
        <input
          className="library-search-input"
          type="text"
          placeholder="按标题搜索案例…"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
        />
      </div>

      {!isSearching && (
        <div className="library-breadcrumb">
          <button
            className="library-breadcrumb-item"
            onClick={() => setFolderPath([])}
            disabled={folderPath.length === 0}
          >
            全部
          </button>
          {folderPath.map((folder, index) => (
            <span key={folder.id}>
              <span className="library-breadcrumb-sep"> / </span>
              <button
                className="library-breadcrumb-item"
                onClick={() => setFolderPath((prev) => prev.slice(0, index + 1))}
                disabled={index === folderPath.length - 1}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {!isSearching && (
        <section className="library-section">
          <h2>文件夹</h2>
          <div className="home-create-form">
            <input
              type="text"
              placeholder="新建子文件夹名称"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              新建文件夹
            </button>
          </div>
          {loading ? (
            <p>加载中…</p>
          ) : subfolders.length === 0 ? (
            <p className="home-empty-hint">这里还没有子文件夹。</p>
          ) : (
            <ul className="library-folder-list">
              {subfolders.map((folder) => (
                <li key={folder.id} className="library-folder-card">
                  {editingFolderId === folder.id ? (
                    <>
                      <input value={editingFolderName} onChange={(e) => setEditingFolderName(e.target.value)} />
                      <button onClick={handleRenameFolderSave}>保存</button>
                      <button onClick={() => setEditingFolderId(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <button className="library-folder-open" onClick={() => setFolderPath((prev) => [...prev, folder])}>
                        📁 {folder.name}
                      </button>
                      <button onClick={() => startRenameFolder(folder)}>重命名</button>
                      <button onClick={() => handleDeleteFolder(folder)}>删除</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="library-section">
        <h2>{isSearching ? `搜索结果（${displayedCases.length}）` : '案例'}</h2>
        {!isSearching && (
          <div className="home-create-form">
            <select value={newCaseType} onChange={(e) => setNewCaseType(e.target.value as StudyCaseType)}>
              {Object.entries(CASE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="给这个案例起个名字"
              value={newCaseTitle}
              onChange={(e) => setNewCaseTitle(e.target.value)}
            />
            <button onClick={handleCreateCase} disabled={!newCaseTitle.trim()}>
              {newCaseType === 'fullgame' ? '新建整局（从标准开局打谱）' : '新建案例（从空白棋盘摆局）'}
            </button>
          </div>
        )}

        {loading && !isSearching ? (
          <p>加载中…</p>
        ) : displayedCases.length === 0 ? (
          <p className="home-empty-hint">
            {isSearching ? '没有找到匹配的案例。' : '这里还没有案例。中局/残局从空白棋盘摆局，整局则从所有棋子摆好的开局开始打谱。'}
          </p>
        ) : (
          <div className="library-case-grid">
            {displayedCases.map((studyCase) => (
              <div
                key={studyCase.id}
                className="library-case-card"
                onClick={() => onOpenCase({ kind: 'case', id: studyCase.id })}
              >
                <div className="library-case-card-header">
                  <span className={`library-case-type-badge library-case-type-${studyCase.type}`}>
                    {CASE_TYPE_LABELS[studyCase.type]}
                  </span>
                  {editingCaseId === studyCase.id ? (
                    <input
                      className="library-case-title-input"
                      value={editingCaseTitle}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingCaseTitle(e.target.value)}
                    />
                  ) : (
                    <span className="library-case-title">{studyCase.title}</span>
                  )}
                </div>
                <p className="library-case-meta">更新于 {formatUpdatedAt(studyCase.updatedAt)}</p>
                {isSearching && (
                  <p className="library-case-meta">所在文件夹：{buildFolderPathLabel(studyCase.folderId, allFolders)}</p>
                )}
                <div className="library-case-actions" onClick={(e) => e.stopPropagation()}>
                  {editingCaseId === studyCase.id ? (
                    <>
                      <button onClick={handleRenameCaseSave}>保存</button>
                      <button onClick={() => setEditingCaseId(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startRenameCase(studyCase)}>重命名</button>
                      <select value={studyCase.folderId ?? ''} onChange={(e) => handleMoveCase(studyCase, e.target.value)}>
                        <option value="">未分类</option>
                        {allFolders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {buildFolderPathLabel(folder.id, allFolders)}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => handleDeleteCase(studyCase)}>删除</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {pendingDelete && (
        <>
          <div className="confirm-dialog-overlay" onClick={() => setPendingDelete(null)} />
          <div className="confirm-dialog">
            <p className="confirm-dialog-message">{pendingDelete.message}</p>
            <div className="confirm-dialog-actions">
              <button onClick={() => setPendingDelete(null)}>取消</button>
              <button className="confirm-dialog-danger" onClick={confirmPendingDelete}>
                确认删除
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
