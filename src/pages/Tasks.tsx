import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AtSign, Bell, Check, HelpCircle, Plus, Trello, X } from 'lucide-react'
import { useTasksStore } from '../store/tasksStore'
import { useTaskSharesStore } from '../store/taskSharesStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import { useBoardsStore } from '../store/boardsStore'
import { useBoardInvitesStore } from '../store/boardInvitesStore'
import { useTeamInvitesStore } from '../store/teamInvitesStore'
import { Users } from 'lucide-react'
import { useNotificationsStore } from '../store/notificationsStore'
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
  const fetchTasks = useTasksStore((s) => s.fetchAll)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const fetchMyProjectTasks = useProjectTasksStore((s) => s.fetchMyTasks)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const [showForm, setShowForm] = useState(false)
  const incoming = useTaskSharesStore((s) => s.incoming)
  const fetchIncoming = useTaskSharesStore((s) => s.fetchIncoming)
  const acceptShare = useTaskSharesStore((s) => s.acceptShare)
  const declineShare = useTaskSharesStore((s) => s.declineShare)
  const boardInvites = useBoardInvitesStore((s) => s.incoming)
  const fetchBoardInvites = useBoardInvitesStore((s) => s.fetchIncoming)
  const acceptInvite = useBoardInvitesStore((s) => s.acceptInvite)
  const declineInvite = useBoardInvitesStore((s) => s.declineInvite)
  const teamInvites = useTeamInvitesStore((s) => s.incoming)
  const fetchTeamInvites = useTeamInvitesStore((s) => s.fetchIncoming)
  const acceptTeamInvite = useTeamInvitesStore((s) => s.acceptInvite)
  const declineTeamInvite = useTeamInvitesStore((s) => s.declineInvite)
  const notifications = useNotificationsStore((s) => s.notifications)
  const fetchNotifications = useNotificationsStore((s) => s.fetch)
  const markRead = useNotificationsStore((s) => s.markRead)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)
  const navigate = useNavigate()

  useEffect(() => {
    if (isSupabaseConfigured && smartList === 'inbox') {
      fetchIncoming()
      fetchBoardInvites()
      fetchTeamInvites()
      fetchNotifications()
    }
  }, [fetchIncoming, fetchBoardInvites, fetchNotifications, smartList])

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchBoards()
      fetchMyProjectTasks()
      fetchTasks()
    }
  }, [fetchBoards, fetchMyProjectTasks, fetchTasks])

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

      {smartList !== 'inbox' && (
        <div className="mb-6 flex gap-1 border-b border-gray-100 dark:border-racing-800">
          <Link
            to="/tasks"
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              smartList !== 'completed'
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-racing-200'
            }`}
          >
            Aufgaben
          </Link>
          <Link
            to="/tasks/completed"
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              smartList === 'completed'
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-racing-200'
            }`}
          >
            <Check size={14} />
            Erledigt
          </Link>
        </div>
      )}

      {smartList === 'inbox' ? (
        <div>
          {boardInvites.length === 0 && teamInvites.length === 0 && incoming.length === 0 && notifications.filter((n) => !n.read || n.type === 'birthday').length === 0 && (
            <p className="py-12 text-center text-sm text-gray-400">Alles erledigt. Keine neuen Benachrichtigungen.</p>
          )}

          {notifications.filter((n) => n.type === 'birthday').length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                🎂 Geburtstage heute
              </h2>
              <div className="flex flex-col gap-2">
                {notifications.filter((n) => n.type === 'birthday').map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      n.read
                        ? 'border-gray-100 bg-white dark:border-racing-800 dark:bg-racing-900'
                        : 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
                    }`}
                  >
                    <span className="text-2xl">🎂</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{n.title.replace('🎂 ', '')}</p>
                      {n.body && <p className="text-xs text-gray-400">{n.body}</p>}
                    </div>
                    {!n.read ? (
                      <button
                        onClick={() => markRead(n.id)}
                        className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                      >
                        <Check size={13} /> Gratuliert!
                      </button>
                    ) : (
                      <span className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-400 dark:bg-racing-800">
                        <Check size={13} /> Erledigt
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {notifications.filter((n) => n.type !== 'birthday').length > 0 && (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Bell size={16} className="text-gray-400" />
                  Benachrichtigungen
                </h2>
                <button onClick={markAllRead} className="text-xs text-accent hover:underline">Alle gelesen</button>
              </div>
              <div className="flex flex-col gap-2">
                {notifications.filter((n) => n.type !== 'birthday').map((n) => {
                  const isQuestion = n.type === 'question'
                  return (
                    <div
                      key={n.id}
                      onClick={() => { markRead(n.id); if (n.link) navigate(n.link) }}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-gray-50 dark:hover:bg-racing-800 ${
                        n.read
                          ? 'border-gray-100 bg-white dark:border-racing-800 dark:bg-racing-900'
                          : isQuestion
                            ? 'border-violet-200 bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/20'
                            : 'border-accent/20 bg-accent/5 dark:border-accent/20 dark:bg-accent/5'
                      }`}
                    >
                      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                        n.read ? 'bg-gray-100 dark:bg-racing-800' : isQuestion ? 'bg-violet-100 dark:bg-violet-900/30' : 'bg-accent/10'
                      }`}>
                        {isQuestion
                          ? <HelpCircle size={14} className={n.read ? 'text-gray-400' : 'text-violet-500'} />
                          : <AtSign size={14} className={n.read ? 'text-gray-400' : 'text-accent'} />
                        }
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${n.read ? '' : isQuestion ? 'text-violet-700 dark:text-violet-400' : 'text-accent'}`}>{n.title}</p>
                        {n.body && (
                          <p className={`mt-0.5 text-xs ${isQuestion ? 'italic text-gray-600 dark:text-racing-300' : 'truncate text-gray-400'}`}>
                            {isQuestion ? `„${n.body}"` : `„${n.body}"`}
                          </p>
                        )}
                      </div>
                      {!n.read && <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${isQuestion ? 'bg-violet-500' : 'bg-accent'}`} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {boardInvites.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <Trello size={16} className="text-gray-400" />
                Projekteinladungen
              </h2>
              <div className="flex flex-col gap-2">
                {boardInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: invite.boardColor }}>
                      {invite.boardTitle.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{invite.boardTitle}</p>
                      <p className="truncate text-xs text-gray-400">von {invite.fromUser.display_name}</p>
                    </div>
                    <button onClick={() => acceptInvite(invite.id)} className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark">
                      <Check size={14} /> Annehmen
                    </button>
                    <button onClick={() => declineInvite(invite.id)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800">
                      <X size={14} /> Ablehnen
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {teamInvites.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <Users size={16} className="text-gray-400" />
                Team-Einladungen
              </h2>
              <div className="flex flex-col gap-2">
                {teamInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Users size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{invite.teamName}</p>
                      <p className="truncate text-xs text-gray-400">von {invite.fromUser.display_name}</p>
                    </div>
                    <button onClick={() => acceptTeamInvite(invite.id)} className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark">
                      <Check size={14} /> Annehmen
                    </button>
                    <button onClick={() => declineTeamInvite(invite.id)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800">
                      <X size={14} /> Ablehnen
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {incoming.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <Check size={16} className="text-gray-400" />
                Aufgaben-Einladungen
              </h2>
              <div className="flex flex-col gap-2">
                {incoming.map((share) => (
                  <div key={share.id} className="rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900">
                    <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: share.fromUser.avatar_color }}>
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
                    <button onClick={() => acceptShare(share.id)} className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark">
                      <Check size={14} /> Annehmen
                    </button>
                    <button onClick={() => declineShare(share.id)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800">
                      <X size={14} /> Ablehnen
                    </button>
                    </div>
                    {share.message && (
                      <div className="mt-2 ml-12 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-racing-800 dark:text-racing-200">
                        💬 {share.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <TaskList
          tasks={filtered}
          groupByDate={groupByDate}
          flat={smartList === 'completed'}
          emptyMessage={smartList === 'completed' ? 'Keine erledigten Aufgaben' : 'Keine Aufgaben'}
        />
      )}

      {showForm && (
        <TaskFormModal defaultDueDate={defaultDueDate} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}
