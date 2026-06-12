import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Plus, X } from 'lucide-react'
import { useTasksStore } from '../store/tasksStore'
import { useTaskSharesStore } from '../store/taskSharesStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import { useBoardsStore } from '../store/boardsStore'
import { isSupabaseConfigured } from '../lib/supabase'
import TaskList from '../components/tasks/TaskList'
import TaskFormModal from '../components/tasks/TaskFormModal'
import PriorityBadge from '../components/tasks/PriorityBadge'
import { formatFriendlyDate, isDueThisWeek, isDueToday, isOverdue, todayISO } from '../utils/date'

const titles: Record<string, string> = {
  today: 'Heute',
  week: 'Diese Woche fällig',
  inbox: 'Inbox',
  completed: 'Erledigt',
}

export default function TasksPage() {
  const { smartList } = useParams()
  const tasks = useTasksStore((s) => s.tasks)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const fetchMyProjectTasks = useProjectTasksStore((s) => s.fetchMyTasks)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const [showForm, setShowForm] = useState(false)
  const incoming = useTaskSharesStore((s) => s.incoming)
  const fetchIncoming = useTaskSharesStore((s) => s.fetchIncoming)
  const acceptShare = useTaskSharesStore((s) => s.acceptShare)
  const declineShare = useTaskSharesStore((s) => s.declineShare)

  useEffect(() => {
    if (isSupabaseConfigured && smartList === 'inbox') fetchIncoming()
  }, [fetchIncoming, smartList])

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchBoards()
      fetchMyProjectTasks()
    }
  }, [fetchBoards, fetchMyProjectTasks])

  const allTasks = [...tasks, ...myProjectTasks]

  let filtered = tasks
  let groupByDate = false
  let title = 'Alle Aufgaben'
  let defaultDueDate: string | undefined

  if (smartList === 'today') {
    filtered = allTasks.filter((t) => !t.completed && (isDueToday(t.dueDate) || isOverdue(t.dueDate)))
    title = titles.today
    defaultDueDate = todayISO()
  } else if (smartList === 'week') {
    filtered = allTasks.filter(
      (t) => !t.completed && (isOverdue(t.dueDate) || isDueToday(t.dueDate) || isDueThisWeek(t.dueDate))
    )
    title = titles.week
  } else if (smartList === 'inbox') {
    filtered = tasks.filter((t) => !t.completed && !t.boardId && !t.dueDate)
    title = titles.inbox
  } else if (smartList === 'completed') {
    filtered = allTasks.filter((t) => t.completed)
    title = titles.completed
  } else {
    filtered = allTasks.filter((t) => !t.completed)
    groupByDate = true
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          <Plus size={16} />
          Aufgabe
        </button>
      </div>

      {smartList === 'inbox' && incoming.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Erhaltene Aufgaben</h2>
          <div className="flex flex-col gap-2">
            {incoming.map((share) => (
              <div
                key={share.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900"
              >
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: share.fromUser.avatar_color }}
                >
                  {share.fromUser.display_name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{share.task.title}</p>
                  <p className="truncate text-xs text-gray-400">
                    von {share.fromUser.display_name}
                    {share.task.due_date && ` · fällig ${formatFriendlyDate(share.task.due_date)}`}
                  </p>
                </div>
                <PriorityBadge priority={share.suggestedPriority ?? share.task.priority} />
                <button
                  onClick={() => acceptShare(share.id)}
                  className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                >
                  <Check size={14} />
                  Annehmen
                </button>
                <button
                  onClick={() => declineShare(share.id)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
                >
                  <X size={14} />
                  Ablehnen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <TaskList tasks={filtered} groupByDate={groupByDate} />

      {showForm && (
        <TaskFormModal defaultDueDate={defaultDueDate} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}
