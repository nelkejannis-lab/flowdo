import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTaskTimeStore, type TaskTimeEntry } from '../../store/taskTimeStore'
import { useAuthStore } from '../../store/authStore'
import { todayISO, formatFriendlyDate } from '../../utils/date'
import { formatHM } from '../../utils/worktime'

const QUICK_MINUTES = [15, 30, 45, 60] as const

interface TaskManualTimeLogProps {
  taskId: string
  boardId?: string | null
  className?: string
}

export default function TaskManualTimeLog({
  taskId,
  boardId = null,
  className = '',
}: TaskManualTimeLogProps) {
  const { t } = useTranslation('tasks')
  const userId = useAuthStore((s) => s.user?.id)
  const entries = useTaskTimeStore((s) => s.entries.filter((e) => e.taskId === taskId))
  const addEntry = useTaskTimeStore((s) => s.addEntry)
  const updateEntry = useTaskTimeStore((s) => s.updateEntry)
  const deleteEntry = useTaskTimeStore((s) => s.deleteEntry)

  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(30)
  const [date, setDate] = useState(todayISO())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHours, setEditHours] = useState(0)
  const [editMinutes, setEditMinutes] = useState(0)
  const [editDate, setEditDate] = useState('')

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [entries]
  )
  const totalMinutes = useMemo(() => entries.reduce((sum, e) => sum + e.minutes, 0), [entries])

  function splitMinutes(total: number) {
    const abs = Math.max(0, Math.round(total))
    return { h: Math.floor(abs / 60), m: abs % 60 }
  }

  function startEdit(entry: TaskTimeEntry) {
    const { h, m } = splitMinutes(entry.minutes)
    setEditingId(entry.id)
    setEditHours(h)
    setEditMinutes(m)
    setEditDate(entry.date)
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!userId) return
    const total = hours * 60 + minutes
    if (total <= 0) return
    await addEntry({
      taskId,
      boardId: boardId ?? undefined,
      ownerId: boardId ? undefined : userId,
      userId,
      minutes: total,
      date,
      note: t('manualTime.manualNote'),
    })
    setHours(0)
    setMinutes(30)
    setDate(todayISO())
  }

  async function saveEdit() {
    if (!editingId) return
    const total = editHours * 60 + editMinutes
    if (total <= 0) return
    await updateEntry(editingId, { minutes: total, date: editDate })
    setEditingId(null)
  }

  function applyQuick(m: number) {
    setHours(Math.floor(m / 60))
    setMinutes(m % 60)
  }

  return (
    <div
      className={`mt-3 border-t border-emerald-100 pt-3 dark:border-emerald-900/40 ${className}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-300/70">
        {t('manualTime.title')}
      </p>

      <form onSubmit={(e) => void handleAdd(e)} className="mb-3 flex flex-wrap items-end gap-2">
        <div className="flex gap-1">
          {QUICK_MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => applyQuick(m)}
              className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors ${
                hours * 60 + minutes === m
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/80 text-gray-600 hover:bg-emerald-100 dark:bg-racing-900 dark:text-racing-200 dark:hover:bg-emerald-900/40'
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] text-gray-500 dark:text-racing-400">{t('manualTime.hours')}</label>
          <input
            type="number"
            min={0}
            max={24}
            value={hours}
            onChange={(e) => setHours(Math.max(0, Number(e.target.value) || 0))}
            className="w-14 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-racing-700 dark:bg-racing-950"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] text-gray-500 dark:text-racing-400">{t('manualTime.minutes')}</label>
          <input
            type="number"
            min={0}
            max={59}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
            className="w-14 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-racing-700 dark:bg-racing-950"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] text-gray-500 dark:text-racing-400">{t('manualTime.date')}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-racing-700 dark:bg-racing-950"
          />
        </div>
        <button
          type="submit"
          disabled={!userId || hours * 60 + minutes <= 0}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
        >
          <Plus size={12} />
          {t('manualTime.add')}
        </button>
      </form>

      {totalMinutes > 0 && (
        <p className="mb-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {t('manualTime.total', { time: formatHM(totalMinutes) })}
        </p>
      )}

      {sortedEntries.length === 0 ? (
        <p className="text-xs italic text-gray-400">{t('manualTime.empty')}</p>
      ) : (
        <ul className="flex max-h-36 flex-col gap-1 overflow-y-auto">
          {sortedEntries.map((entry) => {
            if (editingId === entry.id) {
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-end gap-2 rounded-lg bg-white/70 p-2 dark:bg-racing-900/60"
                >
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={editHours}
                    onChange={(e) => setEditHours(Math.max(0, Number(e.target.value) || 0))}
                    className="w-12 rounded border px-2 py-1 text-xs dark:border-racing-700 dark:bg-racing-950"
                  />
                  <span className="text-xs text-gray-400">h</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={editMinutes}
                    onChange={(e) => setEditMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                    className="w-12 rounded border px-2 py-1 text-xs dark:border-racing-700 dark:bg-racing-950"
                  />
                  <span className="text-xs text-gray-400">m</span>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="rounded border px-2 py-1 text-xs dark:border-racing-700 dark:bg-racing-950"
                  />
                  <button
                    type="button"
                    onClick={() => void saveEdit()}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                  >
                    {t('manualTime.save')}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">
                    {t('manualTime.cancel')}
                  </button>
                </li>
              )
            }
            const isTimer = entry.note === 'Timer'
            return (
              <li
                key={entry.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-white/60 dark:hover:bg-racing-900/50"
              >
                <span className="w-14 font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatHM(entry.minutes)}
                </span>
                <span className="w-20 text-gray-400">{formatFriendlyDate(entry.date)}</span>
                <span className="min-w-0 flex-1 truncate text-gray-500">
                  {isTimer ? t('manualTime.timerEntry') : entry.note ?? t('manualTime.manualNote')}
                </span>
                <button
                  type="button"
                  onClick={() => startEdit(entry)}
                  className="text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
                  title={t('manualTime.edit')}
                  aria-label={t('manualTime.edit')}
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => void deleteEntry(entry.id)}
                  className="text-gray-300 hover:text-red-500"
                  title={t('manualTime.delete')}
                  aria-label={t('manualTime.delete')}
                >
                  <Trash2 size={12} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
