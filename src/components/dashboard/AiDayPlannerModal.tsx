import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Clock, Loader2, AlertCircle, CalendarClock } from 'lucide-react'
import Modal from '../layout/Modal'
import { useTasksStore } from '../../store/tasksStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { useBoardsStore } from '../../store/boardsStore'
import { useCalendarEntriesStore } from '../../store/calendarEntriesStore'
import { useDayPlanStore, type DayPlanItem } from '../../store/dayPlanStore'
import { usePriorityPlanStore } from '../../store/priorityPlanStore'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { expandRecurringEntries } from '../../utils/recurrence'
import { todayISO, isDueToday, isOverdue } from '../../utils/date'
import {
  packTasksIntoFreeSlots,
  parseHHMM,
  type MinuteRange,
  type PackableTask,
  type PackedPlacement,
} from '../../lib/daySlotPacker'
import type { Task } from '../../types'

const WORK_START_DEFAULT = 9 * 60
const BUFFER_MIN = 5

function eisenhowerRank(t: { urgent: boolean; important: boolean; priority: string }): number {
  if (t.urgent && t.important) return 0
  if (!t.urgent && t.important) return 1
  if (t.urgent && !t.important) return 2
  return 3
}

const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }

function sortByEisenhower<T extends { urgent: boolean; important: boolean; priority: string }>(arr: T[]): T[] {
  return [...arr].sort(
    (a, b) =>
      eisenhowerRank(a) - eisenhowerRank(b) ||
      (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1),
  )
}

function isProjectTask(task: Task, projectIds: Set<string>): boolean {
  return Boolean(task.boardId) || projectIds.has(task.id)
}

interface AiDayPlannerModalProps {
  onClose: () => void
}

type Step = 'estimates' | 'preview' | 'empty'

export default function AiDayPlannerModal({ onClose }: AiDayPlannerModalProps) {
  const { t } = useTranslation('dashboard')
  const personalTasks = useTasksStore((s) => s.tasks)
  const updatePersonal = useTasksStore((s) => s.updateTask)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const updateProject = useProjectTasksStore((s) => s.updateTask)
  const boards = useBoardsStore((s) => s.boards)
  const calendarEntries = useCalendarEntriesStore((s) => s.entries)
  const hiddenOccurrences = useCalendarEntriesStore((s) => s.hiddenOccurrences)
  const setDayPlanItems = useDayPlanStore((s) => s.setItems)
  const dayOrders = usePriorityPlanStore((s) => s.dayOrders)
  const tomorrowTop3 = usePriorityPlanStore((s) => s.tomorrowTop3)
  const applyOrder = usePriorityPlanStore((s) => s.applyOrder)
  const weekdayHours = useWorkTimeStore((s) => s.settings.weekdayHours)

  const today = todayISO()
  const projectIdSet = useMemo(() => new Set(myProjectTasks.map((tk) => tk.id)), [myProjectTasks])

  const orderedOpen = useMemo(() => {
    const all = [...personalTasks, ...myProjectTasks]
    const open = all.filter((tk) => !tk.completed && (isDueToday(tk.dueDate) || isOverdue(tk.dueDate)))
    return applyOrder(sortByEisenhower(open), dayOrders[today] ?? tomorrowTop3[today])
  }, [personalTasks, myProjectTasks, applyOrder, dayOrders, tomorrowTop3, today])

  const [estimates, setEstimates] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const tk of orderedOpen) {
      if (tk.estimatedMinutes && tk.estimatedMinutes > 0) {
        init[tk.id] = String(tk.estimatedMinutes)
      } else {
        init[tk.id] = ''
      }
    }
    return init
  })
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const missingEstimateIds = useMemo(
    () =>
      orderedOpen
        .filter((tk) => {
          const raw = estimates[tk.id]
          const n = Number(raw)
          return !raw?.trim() || !Number.isFinite(n) || n <= 0
        })
        .map((tk) => tk.id),
    [orderedOpen, estimates],
  )

  const workWindow = useMemo((): MinuteRange => {
    const hours = weekdayHours && weekdayHours > 0 ? weekdayHours : 8
    return { start: WORK_START_DEFAULT, end: WORK_START_DEFAULT + Math.round(hours * 60) }
  }, [weekdayHours])

  const busyRanges = useMemo((): MinuteRange[] => {
    const todaysEntries = expandRecurringEntries(
      calendarEntries,
      today,
      today,
      new Set(hiddenOccurrences),
    ).filter((e) => (e.endDate ? e.date <= today && e.endDate >= today : e.date === today))

    const ranges: MinuteRange[] = []
    for (const e of todaysEntries) {
      const start = e.startTime ? parseHHMM(e.startTime) : null
      const end = e.endTime ? parseHHMM(e.endTime) : start != null ? start + 30 : null
      if (start == null || end == null || end <= start) continue
      ranges.push({ start, end })
    }
    return ranges
  }, [calendarEntries, hiddenOccurrences, today])

  const packResult = useMemo(() => {
    if (missingEstimateIds.length > 0 || orderedOpen.length === 0) {
      return { placements: [] as PackedPlacement[], overflow: [] as PackableTask[] }
    }
    const packable: PackableTask[] = orderedOpen.map((tk) => {
      const mins = Math.max(5, Math.round(Number(estimates[tk.id])))
      const board = tk.boardId ? boards.find((b) => b.id === tk.boardId) : undefined
      return {
        id: tk.id,
        title: tk.title,
        estimatedMinutes: mins,
        projectId: tk.boardId ?? null,
        projectName: board?.title,
      }
    })
    return packTasksIntoFreeSlots(packable, workWindow, busyRanges, { bufferMin: BUFFER_MIN })
  }, [missingEstimateIds.length, orderedOpen, estimates, boards, workWindow, busyRanges])

  const step: Step =
    orderedOpen.length === 0 ? 'empty' : missingEstimateIds.length > 0 ? 'estimates' : 'preview'

  async function handleApplyPlan() {
    if (packResult.placements.length === 0) return
    setApplying(true)
    setError(null)
    try {
      // Ensure estimates are saved (in case user edited on preview — they can't, but keep consistent)
      for (const p of packResult.placements) {
        const tk = orderedOpen.find((x) => x.id === p.id)
        if (!tk) continue
        if (tk.estimatedMinutes !== p.estimatedMinutes) {
          if (isProjectTask(tk, projectIdSet)) {
            await updateProject(tk.id, { estimatedMinutes: p.estimatedMinutes })
          } else {
            updatePersonal(tk.id, { estimatedMinutes: p.estimatedMinutes })
          }
        }
      }

      for (const p of packResult.placements) {
        const tk = orderedOpen.find((x) => x.id === p.id)
        if (!tk) continue
        const patch = { startTime: p.startTime, estimatedMinutes: p.estimatedMinutes }
        if (isProjectTask(tk, projectIdSet)) {
          await updateProject(tk.id, patch)
        } else {
          updatePersonal(tk.id, patch)
        }
      }

      const planItems: DayPlanItem[] = packResult.placements.map((p) => ({
        id: p.id,
        title: p.title,
        startTime: p.startTime,
        endTime: p.endTime,
        projectId: p.projectId ?? null,
      }))
      setDayPlanItems(today, planItems)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dayPacker.errorGeneric'))
    } finally {
      setApplying(false)
    }
  }

  const missingTasks = orderedOpen.filter((tk) => missingEstimateIds.includes(tk.id))

  return (
    <Modal title={t('dayPacker.title')} onClose={onClose} widthClass="max-w-lg">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500 dark:text-racing-400">{t('dayPacker.subtitle')}</p>

        {step === 'empty' && (
          <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:bg-racing-800/50 dark:text-racing-300">
            {t('dayPacker.noTasks')}
          </p>
        )}

        {step === 'estimates' && (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{t('dayPacker.estimatesGate', { count: missingTasks.length })}</span>
            </div>

            <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
              {orderedOpen.map((tk, idx) => {
                const needs = missingEstimateIds.includes(tk.id)
                const board = tk.boardId ? boards.find((b) => b.id === tk.boardId) : undefined
                return (
                  <div
                    key={tk.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      needs
                        ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700/60 dark:bg-amber-950/20'
                        : 'border-gray-100 dark:border-racing-700'
                    }`}
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tk.title}</p>
                      {board && (
                        <p className="truncate text-[11px] text-gray-400" style={{ color: board.color }}>
                          {board.title}
                        </p>
                      )}
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      <input
                        type="number"
                        min={5}
                        step={5}
                        value={estimates[tk.id] ?? ''}
                        onChange={(e) => setEstimates((prev) => ({ ...prev, [tk.id]: e.target.value }))}
                        placeholder="—"
                        className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm tabular-nums focus:border-accent focus:outline-none dark:border-racing-600 dark:bg-racing-900"
                      />
                      {t('dayPacker.minutesShort')}
                    </label>
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-gray-400">{t('dayPacker.estimatesHint')}</p>
            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-racing-800"
              >
                {t('dayPacker.cancel')}
              </button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2.5 text-sm text-gray-700 dark:text-racing-200">
              <CalendarClock size={16} className="mt-0.5 flex-shrink-0 text-accent" />
              <span>{t('dayPacker.previewHint')}</span>
            </div>

            {packResult.placements.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">{t('dayPacker.noFreeSlots')}</p>
            ) : (
              <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
                {packResult.placements.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-start gap-3 rounded-xl border border-gray-100 px-3 py-2.5 dark:border-racing-700"
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} />
                          {p.startTime} – {p.endTime}
                        </span>
                        <span>
                          {p.estimatedMinutes} {t('dayPacker.minutesShort')}
                        </span>
                        {p.projectName && <span>{p.projectName}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {packResult.overflow.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
                {t('dayPacker.overflow', { count: packResult.overflow.length })}
                <ul className="mt-1 list-inside list-disc">
                  {packResult.overflow.map((o) => (
                    <li key={o.id}>{o.title}</li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-racing-800"
              >
                {t('dayPacker.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleApplyPlan()}
                disabled={applying || packResult.placements.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {applying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {t('dayPacker.apply', { count: packResult.placements.length })}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
