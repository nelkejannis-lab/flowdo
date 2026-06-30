import { useEffect, useMemo, useRef, useState } from 'react'
import { startOfWeek, addDays, isSameDay, format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { Check, Video } from 'lucide-react'
import type { CalendarEntry, CalendarEvent, Task } from '../../types'
import { toISODate } from '../../utils/date'
import { eachEntryDate, eachEventDate } from '../../utils/events'
import { entryTypeIcon } from '../../utils/calendarEntry'
import { detectMeetingProvider } from '../../utils/meetingLink'

const HOUR_HEIGHT = 48 // px per hour
const PX_PER_MIN = HOUR_HEIGHT / 60
const SNAP = 15 // minutes

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  entries?: CalendarEntry[]
  tasks?: Task[] // only tasks with a startTime are shown (actively scheduled)
  onEventClick: (event: CalendarEvent) => void
  onEntryClick: (entry: CalendarEntry) => void
  onTaskClick: (task: Task) => void
  onToggleTask: (task: Task) => void
  onCreateEntryAt: (date: string, startTime: string) => void
  onToggleEntry: (id: string) => void
  onReschedule: (id: string, patch: { date?: string; startTime?: string | null; endTime?: string | null }) => void
  onRescheduleTask: (id: string, patch: { dueDate: string; startTime: string; estimatedMinutes: number }) => void
  onDropTodo: (date: string, startTime: string, todoId: string) => void
  onCreateRange: (startDate: string, endDate: string) => void
}

function minutesOf(hhmm?: string): number | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}
function hhmmOf(min: number): string {
  const c = Math.max(0, Math.min(1439, Math.round(min)))
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`
}

interface PositionedEntry {
  entry: CalendarEntry
  startMin: number
  endMin: number
  lane: number
  lanes: number
}

// Greedy lane assignment so overlapping entries sit side by side.
function layoutDay(items: { entry: CalendarEntry; startMin: number; endMin: number }[]): PositionedEntry[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const laneEnds: number[] = []
  const placed = sorted.map((it) => {
    let lane = laneEnds.findIndex((end) => end <= it.startMin)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.endMin) } else laneEnds[lane] = it.endMin
    return { ...it, lane, lanes: 1 }
  })
  const lanes = Math.max(1, laneEnds.length)
  return placed.map((p) => ({ ...p, lanes }))
}

export default function WeekView({
  currentDate,
  events,
  entries = [],
  tasks = [],
  onEventClick,
  onEntryClick,
  onTaskClick,
  onToggleTask,
  onCreateEntryAt,
  onToggleEntry,
  onReschedule,
  onRescheduleTask,
  onDropTodo,
  onCreateRange,
}: WeekViewProps) {
  const { i18n } = useTranslation('calendar')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const dayIsos = days.map(toISODate)

  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const suppressClickRef = useRef(false)

  // minute tick for the now-line
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // scroll to ~07:00 on mount
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT
  }, [])

  // ── all-day band (events + entries without a start time), per covered day ──
  const allDayByDay = new Map<string, { kind: 'event' | 'entry'; item: any }[]>()
  for (const iso of dayIsos) allDayByDay.set(iso, [])
  for (const event of events) {
    for (const iso of eachEventDate(event)) {
      if (allDayByDay.has(iso)) allDayByDay.get(iso)!.push({ kind: 'event', item: event })
    }
  }
  for (const entry of entries) {
    if (entry.startTime) continue
    for (const iso of eachEntryDate(entry)) {
      if (allDayByDay.has(iso)) allDayByDay.get(iso)!.push({ kind: 'entry', item: entry })
    }
  }

  // ── timed entries positioned in the grid, per day ──
  const timedByDay = new Map<string, PositionedEntry[]>()
  for (const iso of dayIsos) {
    const dayItems = entries
      .filter((e) => e.startTime && e.date === iso)
      .map((e) => {
        const startMin = minutesOf(e.startTime) ?? 0
        const endMin = Math.max(startMin + 30, minutesOf(e.endTime) ?? startMin + 60)
        return { entry: e, startMin, endMin }
      })
    timedByDay.set(iso, layoutDay(dayItems))
  }

  // ── scheduled tasks (only those a user actively placed = have a startTime) ──
  const tasksByDay = new Map<string, { task: Task; startMin: number; endMin: number }[]>()
  for (const iso of dayIsos) {
    tasksByDay.set(
      iso,
      tasks
        .filter((tk) => tk.startTime && tk.dueDate === iso)
        .map((tk) => {
          const startMin = minutesOf(tk.startTime) ?? 0
          const endMin = startMin + Math.max(30, tk.estimatedMinutes ?? 60)
          return { task: tk, startMin, endMin }
        })
    )
  }

  // ── drag / resize ──
  const [drag, setDrag] = useState<{
    id: string
    kind: 'entry' | 'task'
    mode: 'move' | 'resize'
    startClientX: number
    startClientY: number
    origStartMin: number
    origEndMin: number
    origDayIndex: number
    curStartMin: number
    curEndMin: number
    curDayIndex: number
  } | null>(null)

  // ── multi-day range selection in the all-day band ──
  const [rangeSel, setRangeSel] = useState<{ start: number; end: number } | null>(null)
  useEffect(() => {
    if (!rangeSel) return
    function onUp() {
      setRangeSel((r) => {
        if (r) {
          const a = Math.min(r.start, r.end)
          const b = Math.max(r.start, r.end)
          onCreateRange(dayIsos[a], dayIsos[b])
        }
        return null
      })
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [rangeSel, dayIsos, onCreateRange])

  function beginDrag(
    e: React.PointerEvent,
    item: { id: string; startMin: number; endMin: number },
    dayIndex: number,
    mode: 'move' | 'resize',
    kind: 'entry' | 'task'
  ) {
    e.stopPropagation()
    e.preventDefault()
    setDrag({
      id: item.id,
      kind,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origStartMin: item.startMin,
      origEndMin: item.endMin,
      origDayIndex: dayIndex,
      curStartMin: item.startMin,
      curEndMin: item.endMin,
      curDayIndex: dayIndex,
    })
  }

  useEffect(() => {
    if (!drag) return
    function onMove(ev: PointerEvent) {
      setDrag((d) => {
        if (!d) return d
        const dyMin = Math.round((ev.clientY - d.startClientY) / PX_PER_MIN / SNAP) * SNAP
        let curDayIndex = d.origDayIndex
        if (d.mode === 'move' && gridRef.current) {
          const rect = gridRef.current.getBoundingClientRect()
          const colW = rect.width / 7
          curDayIndex = Math.max(0, Math.min(6, Math.floor((ev.clientX - rect.left) / colW)))
        }
        if (d.mode === 'move') {
          const dur = d.origEndMin - d.origStartMin
          let s = d.origStartMin + dyMin
          s = Math.max(0, Math.min(1440 - dur, s))
          return { ...d, curStartMin: s, curEndMin: s + dur, curDayIndex }
        } else {
          let e2 = Math.max(d.origStartMin + SNAP, d.origEndMin + dyMin)
          e2 = Math.min(1440, e2)
          return { ...d, curEndMin: e2 }
        }
      })
    }
    function onUp() {
      setDrag((d) => {
        if (d) {
          const moved = d.curStartMin !== d.origStartMin || d.curEndMin !== d.origEndMin || d.curDayIndex !== d.origDayIndex
          if (moved) {
            const newDate = d.curDayIndex !== d.origDayIndex ? dayIsos[d.curDayIndex] : undefined
            if (d.kind === 'entry') {
              const patch: { date?: string; startTime?: string | null; endTime?: string | null } = {
                startTime: hhmmOf(d.curStartMin),
                endTime: hhmmOf(d.curEndMin),
              }
              if (d.mode === 'move' && newDate) patch.date = newDate
              onReschedule(d.id, patch)
            } else {
              onRescheduleTask(d.id, {
                dueDate: d.mode === 'move' && newDate ? newDate : dayIsos[d.origDayIndex],
                startTime: hhmmOf(d.curStartMin),
                estimatedMinutes: Math.max(15, d.curEndMin - d.curStartMin),
              })
            }
            suppressClickRef.current = true // don't let the trailing click create/open anything
          }
        }
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, dayIsos, onReschedule, onRescheduleTask])

  function handleGridClick(e: React.MouseEvent, iso: string) {
    if (drag) return
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const min = Math.round((e.clientY - rect.top) / PX_PER_MIN / 30) * 30
    onCreateEntryAt(iso, hhmmOf(min))
  }

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-racing-800">
      {/* Day headers */}
      <div className="flex border-b border-gray-100 dark:border-racing-800">
        <div className="w-12 flex-shrink-0 sm:w-14" />
        {days.map((day) => {
          const iso = toISODate(day)
          const isToday = isSameDay(day, now)
          const count = (allDayByDay.get(iso)?.length ?? 0) + (timedByDay.get(iso)?.length ?? 0)
          return (
            <div key={iso} className="flex-1 border-l border-gray-100 px-1 py-2 text-center dark:border-racing-800">
              <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{format(day, 'EEE', { locale: dateLocale })}</div>
              <div className="mt-0.5 flex items-center justify-center gap-1">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? 'bg-accent text-white' : 'text-gray-700 dark:text-racing-100'}`}>
                  {format(day, 'd')}
                </span>
                {count > 0 && <span className="text-[10px] text-gray-400">{count}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day band — drag across days to create a multi-day entry */}
      <div className="flex border-b border-gray-100 dark:border-racing-800">
        <div className="flex w-12 flex-shrink-0 items-center justify-end pr-1 text-[9px] uppercase text-gray-400 sm:w-14">all-day</div>
        {dayIsos.map((iso, idx) => {
          const inRange = rangeSel && idx >= Math.min(rangeSel.start, rangeSel.end) && idx <= Math.max(rangeSel.start, rangeSel.end)
          return (
          <div
            key={iso}
            onPointerDown={(e) => { e.preventDefault(); setRangeSel({ start: idx, end: idx }) }}
            onPointerEnter={() => setRangeSel((r) => (r ? { ...r, end: idx } : r))}
            className={`min-h-[28px] flex-1 cursor-pointer space-y-0.5 border-l border-gray-100 p-0.5 dark:border-racing-800 ${inRange ? 'bg-accent/15' : ''}`}
          >
            {(allDayByDay.get(iso) ?? []).map(({ kind, item }, i) => (
              <button
                key={`${kind}-${item.id}-${i}`}
                onClick={() => (kind === 'entry' ? onEntryClick(item) : onEventClick(item))}
                className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-white"
                style={{ backgroundColor: item.color }}
              >
                {kind === 'entry' ? `${entryTypeIcon[(item as CalendarEntry).type]} ` : ''}{item.title}
              </button>
            ))}
          </div>
        )})}
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto">
        <div className="flex" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* hour labels */}
          <div className="w-12 flex-shrink-0 sm:w-14">
            {hours.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-1.5 right-1 text-[10px] text-gray-400">{h.toString().padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* day columns */}
          <div ref={gridRef} className="relative flex flex-1">
            {dayIsos.map((iso, dayIndex) => {
              const isToday = iso === toISODate(now)
              return (
                <div
                  key={iso}
                  className="relative flex-1 border-l border-gray-100 dark:border-racing-800"
                  onClick={(e) => handleGridClick(e, iso)}
                  onDragOver={(e) => { if (e.dataTransfer.types.includes('text/todo-id')) e.preventDefault() }}
                  onDrop={(e) => {
                    const todoId = e.dataTransfer.getData('text/todo-id')
                    if (!todoId) return
                    e.preventDefault()
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const min = Math.round((e.clientY - rect.top) / PX_PER_MIN / SNAP) * SNAP
                    onDropTodo(iso, hhmmOf(min), todoId)
                  }}
                >
                  {/* hour lines */}
                  {hours.map((h) => (
                    <div key={h} className="border-b border-gray-50 dark:border-racing-900/60" style={{ height: HOUR_HEIGHT }} />
                  ))}

                  {/* now-line */}
                  {isToday && (
                    <div className="pointer-events-none absolute left-0 right-0 z-20 flex items-center" style={{ top: nowMin * PX_PER_MIN }}>
                      <span className="h-2 w-2 -ml-1 rounded-full bg-red-500" />
                      <div className="h-px flex-1 bg-red-500" />
                    </div>
                  )}

                  {/* timed entries */}
                  {(timedByDay.get(iso) ?? []).map((pe) => {
                    const dragging = drag?.id === pe.entry.id
                    const startMin = dragging ? drag!.curStartMin : pe.startMin
                    const endMin = dragging ? drag!.curEndMin : pe.endMin
                    const showOnDay = dragging && drag!.mode === 'move' ? drag!.curDayIndex === dayIndex : true
                    if (!showOnDay) return null
                    const widthPct = 100 / pe.lanes
                    const meeting = detectMeetingProvider(pe.entry.meetingLink)
                    const done = pe.entry.completed
                    return (
                      <div
                        key={pe.entry.id}
                        onClick={(e) => { e.stopPropagation(); if (!drag) onEntryClick(pe.entry) }}
                        onPointerDown={(e) => beginDrag(e, { id: pe.entry.id, startMin: pe.startMin, endMin: pe.endMin }, dayIndex, 'move', 'entry')}
                        className={`absolute z-10 cursor-grab overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-[10px] leading-tight text-white shadow-sm active:cursor-grabbing ${dragging ? 'opacity-80 ring-2 ring-white/40' : ''}`}
                        style={{
                          top: startMin * PX_PER_MIN,
                          height: Math.max(18, (endMin - startMin) * PX_PER_MIN - 2),
                          left: `calc(${pe.lane * widthPct}% + 1px)`,
                          width: `calc(${widthPct}% - 2px)`,
                          backgroundColor: pe.entry.color,
                          borderLeftColor: 'rgba(255,255,255,0.6)',
                        }}
                      >
                        <div className="flex items-start gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleEntry(pe.entry.id) }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className={`mt-px flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full border ${done ? 'border-white bg-white/90 text-gray-700' : 'border-white/70'}`}
                          >
                            {done && <Check size={8} />}
                          </button>
                          <span className={`min-w-0 flex-1 truncate font-semibold ${done ? 'line-through opacity-70' : ''}`}>{pe.entry.title}</span>
                          {meeting && <Video size={10} className="flex-shrink-0 opacity-90" />}
                        </div>
                        <div className="truncate opacity-80">{pe.entry.startTime}{pe.entry.endTime ? `–${pe.entry.endTime}` : ''}</div>
                        {pe.entry.invitees.length > 0 && (
                          <div className="mt-0.5 flex -space-x-1">
                            {pe.entry.invitees.slice(0, 3).map((inv) => (
                              <span key={inv.id} title={inv.display_name} className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold ring-1 ring-white/40" style={{ backgroundColor: inv.avatar_color }}>
                                {inv.display_name[0]?.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* resize handle */}
                        <div
                          onPointerDown={(e) => beginDrag(e, { id: pe.entry.id, startMin: pe.startMin, endMin: pe.endMin }, dayIndex, 'resize', 'entry')}
                          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                        />
                      </div>
                    )
                  })}

                  {/* scheduled tasks (placed via drag) — movable + resizable like entries */}
                  {(tasksByDay.get(iso) ?? []).map((tb) => {
                    const dragging = drag?.kind === 'task' && drag.id === tb.task.id
                    const startMin = dragging ? drag!.curStartMin : tb.startMin
                    const endMin = dragging ? drag!.curEndMin : tb.endMin
                    const showOnDay = dragging && drag!.mode === 'move' ? drag!.curDayIndex === dayIndex : true
                    if (!showOnDay) return null
                    return (
                    <div
                      key={tb.task.id}
                      onClick={(e) => { e.stopPropagation(); if (!drag) onTaskClick(tb.task) }}
                      onPointerDown={(e) => beginDrag(e, { id: tb.task.id, startMin: tb.startMin, endMin: tb.endMin }, dayIndex, 'move', 'task')}
                      className={`absolute z-10 cursor-grab overflow-hidden rounded-md border border-dashed border-accent/60 bg-accent/10 px-1.5 py-1 text-[10px] leading-tight text-accent active:cursor-grabbing ${dragging ? 'opacity-80 ring-2 ring-accent/40' : ''}`}
                      style={{
                        top: startMin * PX_PER_MIN,
                        height: Math.max(18, (endMin - startMin) * PX_PER_MIN - 2),
                        left: '1px',
                        right: '1px',
                      }}
                    >
                      <div className="flex items-start gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleTask(tb.task) }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`mt-px flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full border ${tb.task.completed ? 'border-accent bg-accent text-white' : 'border-accent/70'}`}
                        >
                          {tb.task.completed && <Check size={8} />}
                        </button>
                        <span className={`min-w-0 flex-1 truncate font-semibold ${tb.task.completed ? 'line-through opacity-60' : ''}`}>{tb.task.title}</span>
                      </div>
                      <div className="truncate opacity-70">{hhmmOf(startMin)}–{hhmmOf(endMin)}</div>
                      {/* resize handle */}
                      <div
                        onPointerDown={(e) => beginDrag(e, { id: tb.task.id, startMin: tb.startMin, endMin: tb.endMin }, dayIndex, 'resize', 'task')}
                        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                      />
                    </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
