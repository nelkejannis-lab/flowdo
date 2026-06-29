import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Check, Loader2, Clock, Flame, Star } from 'lucide-react'
import Modal from '../layout/Modal'
import { useAiSchedulerStore, type PlannedTaskItem } from '../../store/aiSchedulerStore'
import { useTasksStore } from '../../store/tasksStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { useBoardsStore } from '../../store/boardsStore'
import { useCalendarEntriesStore } from '../../store/calendarEntriesStore'
import { expandRecurringEntries } from '../../utils/recurrence'
import { todayISO } from '../../utils/date'

interface AiDayPlannerModalProps {
  onClose: () => void
}

interface PlannedItemState extends PlannedTaskItem {
  id: string
  included: boolean
}

export default function AiDayPlannerModal({ onClose }: AiDayPlannerModalProps) {
  const { t } = useTranslation('dashboard')
  const planDay = useAiSchedulerStore((s) => s.planDay)
  const addTask = useTasksStore((s) => s.addTask)
  const tasks = useTasksStore((s) => s.tasks)
  const addProjectTask = useProjectTasksStore((s) => s.addTask)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const boards = useBoardsStore((s) => s.boards)
  const calendarEntries = useCalendarEntriesStore((s) => s.entries)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PlannedItemState[] | null>(null)
  const [importing, setImporting] = useState(false)

  const today = todayISO()

  async function handleGenerate() {
    if (!input.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const todaysEntries = expandRecurringEntries(calendarEntries, today, today).filter((e) =>
        e.endDate ? e.date <= today && e.endDate >= today : e.date === today
      )
      const todaysTasks = [...tasks, ...myProjectTasks].filter((t) => !t.completed && t.dueDate === today)

      const planned = await planDay(input, {
        boards: boards.map((b) => ({ id: b.id, title: b.title })),
        busyEntries: todaysEntries.map((e) => ({ title: e.title, startTime: e.startTime, endTime: e.endTime })),
        existingTasks: todaysTasks.map((t) => ({ title: t.title, startTime: t.startTime, estimatedMinutes: t.estimatedMinutes })),
      })

      setItems(planned.map((p, i) => ({ ...p, id: `${Date.now()}-${i}`, included: true })))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiPlanner.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  function toggleItem(id: string) {
    setItems((prev) => prev?.map((it) => (it.id === id ? { ...it, included: !it.included } : it)) ?? null)
  }

  async function handleImport() {
    if (!items) return
    const selected = items.filter((it) => it.included)
    if (selected.length === 0) return
    setImporting(true)
    try {
      for (const it of selected) {
        if (it.projectId) {
          const board = boards.find((b) => b.id === it.projectId)
          await addProjectTask({
            title: it.title,
            dueDate: today,
            priority: it.priority,
            urgent: it.urgent,
            important: it.important,
            boardId: it.projectId,
            columnId: board?.columns[0]?.id,
            startTime: it.startTime ?? undefined,
            estimatedMinutes: it.estimatedMinutes ?? undefined,
          })
        } else {
          addTask({
            title: it.title,
            dueDate: today,
            priority: it.priority,
            urgent: it.urgent,
            important: it.important,
            startTime: it.startTime ?? undefined,
            estimatedMinutes: it.estimatedMinutes ?? undefined,
          })
        }
      }
      onClose()
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal title="" onClose={onClose} widthClass="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="-mx-6 -mt-2 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <h2 className="text-base font-bold">{t('aiPlanner.title')}</h2>
          </div>
          <p className="mt-1 text-xs text-white/80">{t('aiPlanner.subtitle')}</p>
        </div>

        {!items && (
          <>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('aiPlanner.placeholder')}
              rows={4}
              autoFocus
              disabled={loading}
              className="rounded-xl border border-gray-200 bg-transparent px-3 py-2.5 text-sm focus:border-accent focus:outline-none disabled:opacity-60 dark:border-racing-700"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-gray-400">{t('aiPlanner.poweredBy')}</span>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!input.trim() || loading}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? t('aiPlanner.generating') : t('aiPlanner.generate')}
              </button>
            </div>
          </>
        )}

        {items && (
          <>
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">{t('aiPlanner.noItems')}</p>
            ) : (
              <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
                {items.map((it) => {
                  const board = it.projectId ? boards.find((b) => b.id === it.projectId) : undefined
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => toggleItem(it.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                        it.included
                          ? 'border-accent/40 bg-accent/5 dark:bg-accent/10'
                          : 'border-gray-200 opacity-50 dark:border-racing-700'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                          it.included ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-racing-600'
                        }`}
                      >
                        {it.included && <Check size={12} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{it.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                          {it.startTime && (
                            <span className="flex items-center gap-1">
                              <Clock size={11} /> {it.startTime}
                            </span>
                          )}
                          {it.estimatedMinutes && <span>{it.estimatedMinutes} {t('aiPlanner.minutesShort')}</span>}
                          {it.urgent && (
                            <span className="flex items-center gap-1 text-red-500">
                              <Flame size={11} /> {t('aiPlanner.urgent')}
                            </span>
                          )}
                          {it.important && (
                            <span className="flex items-center gap-1 text-amber-500">
                              <Star size={11} /> {t('aiPlanner.important')}
                            </span>
                          )}
                          {board && (
                            <span className="rounded-full px-2 py-0.5 text-white" style={{ backgroundColor: board.color }}>
                              {board.title}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setItems(null)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-racing-200"
              >
                {t('aiPlanner.backToInput')}
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || items.every((it) => !it.included)}
                className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
              >
                {importing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {t('aiPlanner.importSelected', { count: items.filter((it) => it.included).length })}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
