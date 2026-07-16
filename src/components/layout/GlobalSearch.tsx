import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Hash, ListTodo, Search, Trello, Plus, Loader2, Brain } from 'lucide-react'
import { useSearchStore } from '../../store/searchStore'
import { useTasksStore } from '../../store/tasksStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { useBoardsStore } from '../../store/boardsStore'
import { useBrainStore } from '../../store/brainStore'
import { parseNaturalDate, parseTaskInput } from '../../utils/date'
import { useAiSchedulerStore } from '../../store/aiSchedulerStore'
import { useQuickTaskModalStore } from '../../store/quickTaskModalStore'
import type { Task } from '../../types'

export default function GlobalSearch() {
  const { t } = useTranslation('layout')
  const isOpen = useSearchStore((s) => s.isOpen)
  const open = useSearchStore((s) => s.open)
  const close = useSearchStore((s) => s.close)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const tasks = useTasksStore((s) => s.tasks)
  const projectTasks = useProjectTasksStore((s) => s.myTasks)
  const boards = useBoardsStore((s) => s.boards)
  const brainPages = useBrainStore((s) => s.pages)
  const [parsing, setParsing] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        open()
      } else if (e.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return { tasks: [] as Task[], boards: [], brainPages: [], tags: [] as string[] }

    const allTasks = [...tasks, ...projectTasks]
    const matchedTasks = allTasks
      .filter((t) => !t.completed && (t.title.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q))))
      .slice(0, 8)
    const matchedBoards = boards
      .filter((b) => b.title.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q))
      .slice(0, 5)
    const matchedBrainPages = brainPages
      .filter((p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q))
      .slice(0, 5)
    const allTags = [...new Set(allTasks.flatMap((t) => t.tags))]
    const matchedTags = allTags.filter((tag) => tag.toLowerCase().includes(q)).slice(0, 5)

    return { tasks: matchedTasks, boards: matchedBoards, brainPages: matchedBrainPages, tags: matchedTags }
  }, [query, tasks, projectTasks, boards, brainPages])

  if (!isOpen) return null

  async function handleCreateTaskFromSearch(input: string) {
    if (!input.trim() || parsing) return
    setParsing(true)
    try {
      let parsed
      try {
        parsed = await useAiSchedulerStore.getState().parseTaskWithAi(input, boards)
      } catch (err) {
        console.error('AI parsing failed, falling back to regex:', err)
        parsed = parseTaskInput(input, boards)
      }
      useQuickTaskModalStore.getState().open({
        defaultTitle: parsed.title,
        defaultDueDate: parsed.dueDate,
        defaultProjectId: parsed.projectId,
        defaultPriority: parsed.priority,
        defaultUrgent: parsed.urgent,
        defaultImportant: parsed.important,
      })
      close()
    } finally {
      setParsing(false)
    }
  }

  function goToTask(task: Task) {
    close()
    navigate(task.boardId ? `/projekte/${task.boardId}` : '/tasks')
  }

  function goToBoard(boardId: string) {
    close()
    navigate(`/projekte/${boardId}`)
  }

  function goToBrain() {
    close()
    navigate(`/creative-board`)
  }

  const hasResults = results.tasks.length > 0 || results.boards.length > 0 || results.brainPages.length > 0 || results.tags.length > 0

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/20 p-4 pt-[12vh] backdrop-blur-sm" onClick={close}>
      <div
        className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white/95 shadow-apple-lg backdrop-blur-xl dark:bg-racing-900/95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-racing-800">
          <Search size={16} className="text-gray-400" />
          <input
            ref={inputRef}
            data-global-search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim() && !parsing) {
                e.preventDefault()
                handleCreateTaskFromSearch(query)
              }
            }}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-base font-medium text-gray-900 focus:outline-none dark:text-white"
          />
          <kbd className="rounded border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-400 dark:border-racing-700">{t('search.esc')}</kbd>
        </div>

        {query.trim() && (
          <div className="overflow-y-auto p-2">
            <div className="mb-3 border-b border-gray-100 pb-3 dark:border-racing-800">
              <button
                onClick={() => handleCreateTaskFromSearch(query)}
                disabled={parsing}
                className="group flex w-full items-center gap-3 rounded-xl bg-accent/10 px-3 py-3 text-left text-sm font-medium text-accent transition-all duration-200 hover:bg-accent hover:text-white dark:bg-accent/20 dark:hover:bg-accent disabled:opacity-50"
              >
                {parsing ? (
                  <Loader2 size={16} className="flex-shrink-0 animate-spin" />
                ) : (
                  <Plus size={16} className="flex-shrink-0 transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110" />
                )}
                <span>
                  {parsing ? "Analysiere mit KI..." : `${t('search.createTask')}: "${query}"`}
                </span>
              </button>
            </div>

            {!hasResults && (
              <p className="py-8 text-center text-sm text-gray-400">{t('search.noResults')}</p>
            )}

            {results.tasks.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('search.tasks')}</p>
                {results.tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => goToTask(task)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-racing-800"
                  >
                    <ListTodo size={14} className="flex-shrink-0 text-gray-400" />
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}
              </div>
            )}

            {results.boards.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('search.projects')}</p>
                {results.boards.map((board) => (
                  <button
                    key={board.id}
                    onClick={() => goToBoard(board.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-racing-800"
                  >
                    <Trello size={14} className="flex-shrink-0" style={{ color: board.color }} />
                    <span className="truncate">{board.title}</span>
                  </button>
                ))}
              </div>
            )}

            {results.brainPages.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Notizen (Creative Board)</p>
                {results.brainPages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => goToBrain()}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-racing-800"
                  >
                    <Brain size={14} className="flex-shrink-0 text-gray-400" />
                    <span className="truncate">{page.title}</span>
                  </button>
                ))}
              </div>
            )}

            {results.tags.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('search.tags')}</p>
                <div className="flex flex-wrap gap-1.5 px-2 py-1">
                  {results.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        close()
                        navigate('/tasks')
                      }}
                      className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-racing-800 dark:text-racing-100 dark:hover:bg-racing-700"
                    >
                      <Hash size={11} />
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
