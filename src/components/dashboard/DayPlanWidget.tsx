import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Pencil, Check, X, Clock } from 'lucide-react'
import { useDayPlanStore, type DayPlanItem } from '../../store/dayPlanStore'
import { useBoardsStore } from '../../store/boardsStore'

interface DayPlanWidgetProps {
  date: string
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function DayPlanWidget({ date }: DayPlanWidgetProps) {
  const { t } = useTranslation('dashboard')
  const items = useDayPlanStore((s) => s.plans[date] ?? [])
  const addItem = useDayPlanStore((s) => s.addItem)
  const updateItem = useDayPlanStore((s) => s.updateItem)
  const removeItem = useDayPlanStore((s) => s.removeItem)
  const boards = useBoardsStore((s) => s.boards)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftStart, setDraftStart] = useState('')
  const [draftEnd, setDraftEnd] = useState('')
  const [adding, setAdding] = useState(false)

  function startEdit(item: DayPlanItem) {
    setEditingId(item.id)
    setDraftTitle(item.title)
    setDraftStart(item.startTime ?? '')
    setDraftEnd(item.endTime ?? '')
    setAdding(false)
  }

  function startAdd() {
    setAdding(true)
    setEditingId(null)
    setDraftTitle('')
    setDraftStart('')
    setDraftEnd('')
  }

  function cancel() {
    setEditingId(null)
    setAdding(false)
  }

  function saveEdit() {
    if (!draftTitle.trim() || !editingId) return
    updateItem(date, editingId, {
      title: draftTitle.trim(),
      startTime: draftStart || null,
      endTime: draftEnd || null,
    })
    setEditingId(null)
  }

  function saveAdd() {
    if (!draftTitle.trim()) return
    addItem(date, {
      id: genId(),
      title: draftTitle.trim(),
      startTime: draftStart || null,
      endTime: draftEnd || null,
      projectId: null,
    })
    setAdding(false)
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white/80 p-5 shadow-sm backdrop-blur-apple dark:border-racing-800 dark:bg-racing-900/80">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent">{t('sections.dayPlan')}</span>
          <h3 className="text-base font-bold text-gray-800 dark:text-racing-100">{t('sections.dayPlanTitle')}</h3>
        </div>
        <button
          type="button"
          onClick={startAdd}
          className="flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-accent-dark"
        >
          <Plus size={14} /> {t('sections.dayPlanAdd')}
        </button>
      </div>

      {items.length === 0 && !adding && (
        <p className="py-4 text-center text-sm text-gray-400">{t('sections.dayPlanEmpty')}</p>
      )}

      <div className="relative flex flex-col gap-3">
        {items.length > 0 && <div className="absolute bottom-2 left-[42px] top-2 w-px bg-gray-200 dark:bg-racing-800" />}
        {items.map((item) => {
          const board = item.projectId ? boards.find((b) => b.id === item.projectId) : undefined
          if (editingId === item.id) {
            return (
              <div key={item.id} className="ml-[60px] flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3">
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder={t('sections.dayPlanNamePlaceholder')}
                  autoFocus
                  className="rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={draftStart}
                    onChange={(e) => setDraftStart(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                  />
                  <span className="text-xs text-gray-400">–</span>
                  <input
                    type="time"
                    value={draftEnd}
                    onChange={(e) => setDraftEnd(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                  />
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={saveEdit} className="rounded-lg bg-accent p-1.5 text-white hover:bg-accent-dark">
                      <Check size={14} />
                    </button>
                    <button onClick={cancel} className="rounded-lg bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200 dark:bg-racing-800">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          }
          return (
            <div key={item.id} className="group flex items-center gap-3">
              <div className="w-[52px] flex-shrink-0 text-right text-[11px] font-semibold leading-tight text-gray-500 dark:text-racing-300">
                {item.startTime ? (
                  <>
                    <div>{item.startTime}</div>
                    {item.endTime && <div className="text-gray-300 dark:text-racing-600">{item.endTime}</div>}
                  </>
                ) : (
                  <Clock size={12} className="ml-auto text-gray-300" />
                )}
              </div>
              <div className="h-2 w-2 flex-shrink-0 rounded-full bg-accent" />
              <div className="flex min-w-0 flex-1 items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2 dark:border-racing-850 dark:bg-racing-950/30">
                <span className="truncate text-sm font-medium text-gray-800 dark:text-racing-100">{item.title}</span>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {board && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: board.color }}
                    >
                      {board.title}
                    </span>
                  )}
                  <button
                    onClick={() => startEdit(item)}
                    className="rounded p-1 text-gray-300 opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => removeItem(date, item.id)}
                    className="rounded p-1 text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {adding && (
          <div className="ml-[60px] flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3">
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder={t('sections.dayPlanNamePlaceholder')}
              autoFocus
              className="rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                className="rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
              <span className="text-xs text-gray-400">–</span>
              <input
                type="time"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
              <div className="ml-auto flex items-center gap-1">
                <button onClick={saveAdd} className="rounded-lg bg-accent p-1.5 text-white hover:bg-accent-dark">
                  <Check size={14} />
                </button>
                <button onClick={cancel} className="rounded-lg bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200 dark:bg-racing-800">
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
