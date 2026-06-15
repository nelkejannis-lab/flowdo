import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { Task } from '../../types'
import { dateGroupLabel, dateGroupOrder } from '../../utils/date'
import EisenhowerTaskRow from './EisenhowerTaskRow'

// Maps the German labels returned by dateGroupLabel()/dateGroupOrder to translation keys.
const dateGroupLabelKeys: Record<string, string> = {
  'Überfällig': 'tasks:dateGroups.overdue',
  'Heute': 'tasks:dateGroups.today',
  'Heute Abend': 'tasks:dateGroups.tonight',
  'Morgen': 'tasks:dateGroups.tomorrow',
  'Diese Woche': 'tasks:dateGroups.thisWeek',
  'Später': 'tasks:dateGroups.later',
  'Ohne Datum': 'tasks:dateGroups.noDate',
}

interface EisenhowerQuadrantProps {
  title: string
  colorClass: string
  icon: React.ReactNode
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onAddTask: () => void
}

export default function EisenhowerQuadrant({
  title,
  colorClass,
  icon,
  tasks,
  onTaskClick,
  onAddTask,
}: EisenhowerQuadrantProps) {
  const { t } = useTranslation(['eisenhower', 'tasks'])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      const label = dateGroupLabel(task.dueDate)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(task)
    }
    const ordered: [string, Task[]][] = []
    for (const label of dateGroupOrder) {
      if (map.has(label)) ordered.push([label, map.get(label)!])
    }
    for (const [label, items] of map) {
      if (!dateGroupOrder.includes(label)) ordered.push([label, items])
    }
    return ordered
  }, [tasks])

  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <div className="flex min-h-[200px] flex-col rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900">
      <div className="mb-2 flex items-center justify-between">
        <div className={`flex items-center gap-2 text-sm font-semibold ${colorClass}`}>
          {icon}
          {title}
        </div>
        <button
          onClick={onAddTask}
          className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
          title={t('quadrant.addTask')}
        >
          <Plus size={16} />
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-300">{t('quadrant.noTasks')}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {groups.map(([label, items]) => {
            const isCollapsed = collapsed.has(label)
            return (
              <div key={label}>
                <button
                  onClick={() => toggleGroup(label)}
                  className="flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400"
                >
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  {dateGroupLabelKeys[label] ? t(dateGroupLabelKeys[label]) : label}
                  <span className="font-normal normal-case text-gray-300">{items.length}</span>
                </button>
                {!isCollapsed && (
                  <div className="flex flex-col">
                    {items.map((task) => (
                      <EisenhowerTaskRow key={task.id} task={task} onClick={() => onTaskClick(task)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
