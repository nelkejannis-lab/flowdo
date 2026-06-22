import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, AtSign, Bell, Check, HelpCircle, Plus, Trello, X, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../store/tasksStore'
import { useTaskSharesStore } from '../store/taskSharesStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import { useBoardsStore } from '../store/boardsStore'
import { useCalendarEntriesStore } from '../store/calendarEntriesStore'
import CalendarEntriesBlock from '../components/calendar/CalendarEntriesBlock'
import { useBoardInvitesStore } from '../store/boardInvitesStore'
import { useTeamInvitesStore } from '../store/teamInvitesStore'
import { Users } from 'lucide-react'
import { useNotificationsStore } from '../store/notificationsStore'
import { isSupabaseConfigured } from '../lib/supabase'
import TaskList from '../components/tasks/TaskList'
import TaskFormModal from '../components/tasks/TaskFormModal'
import PriorityBadge from '../components/tasks/PriorityBadge'
import { formatFriendlyDate, isDueThisWeek, isDueToday, isOverdue, todayISO } from '../utils/date'

const titleKeys: Record<string, string> = {
  today: 'page.titles.today',
  week: 'page.titles.week',
  inbox: 'page.titles.inbox',
  completed: 'page.titles.completed',
  someday: 'page.titles.someday',
}

export default function TasksPage() {
  const { t } = useTranslation('tasks')
  const { smartList } = useParams()
  const tasks = useTasksStore((s) => s.tasks)
  const fetchTasks = useTasksStore((s) => s.fetchAll)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const fetchMyProjectTasks = useProjectTasksStore((s) => s.fetchMyTasks)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const boards = useBoardsStore((s) => s.boards)
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
  const calendarEntries = useCalendarEntriesStore((s) => s.entries)
  const fetchCalendarEntries = useCalendarEntriesStore((s) => s.fetchEntries)
  const [showEntries, setShowEntries] = useState(true)
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  useEffect(() => {
    setSearchQuery('')
    setSelectedTag(null)
    setSelectedProject(null)
  }, [smartList])

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
      fetchCalendarEntries()
    }
  }, [fetchBoards, fetchMyProjectTasks, fetchTasks, fetchCalendarEntries])

  const allTasks = [...tasks, ...myProjectTasks]

  let filtered = tasks
  let groupByDate = false
  let title = t('page.titles.all')
  let defaultDueDate: string | undefined

  if (smartList === 'today') {
    filtered = allTasks.filter((t) => !t.completed && (isDueToday(t.dueDate) || isOverdue(t.dueDate)))
    title = t(titleKeys.today)
    defaultDueDate = todayISO()
  } else if (smartList === 'week') {
    filtered = allTasks.filter(
      (t) => !t.completed && (isOverdue(t.dueDate) || isDueToday(t.dueDate) || isDueThisWeek(t.dueDate))
    )
    title = t(titleKeys.week)
  } else if (smartList === 'inbox') {
    filtered = tasks.filter((t) => !t.completed && !t.boardId && !t.dueDate && !t.someday)
    title = t(titleKeys.inbox)
  } else if (smartList === 'completed') {
    filtered = allTasks.filter((t) => t.completed)
    title = t(titleKeys.completed)
  } else if (smartList === 'someday') {
    filtered = allTasks.filter((t) => !t.completed && t.someday)
    title = t(titleKeys.someday)
  }

  const allUniqueTags = Array.from(new Set(filtered.flatMap((t) => t.tags || []))).filter(Boolean)
  const uniqueBoardIds = Array.from(new Set(filtered.map((t) => t.boardId).filter(Boolean))) as string[]
  const relevantBoards = boards.filter((b) => uniqueBoardIds.includes(b.id))

  let displayTasks = filtered
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim()
    displayTasks = displayTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    )
  }
  if (selectedProject) {
    displayTasks = displayTasks.filter((t) => t.boardId === selectedProject)
  }
  if (selectedTag) {
    displayTasks = displayTasks.filter((t) => t.tags && t.tags.includes(selectedTag))
  }

  const today = todayISO()

  // ISO date of Sunday this week
  const weekEndDate = (() => {
    const d = new Date()
    const day = d.getDay() // 0=Sun
    const diff = day === 0 ? 0 : 7 - day
    const end = new Date(d)
    end.setDate(d.getDate() + diff)
    return end.toISOString().slice(0, 10)
  })()

  const relevantEntries = (() => {
    if (smartList === 'today') {
      return calendarEntries
        .filter((e) => e.date <= today && (!e.endDate || e.endDate >= today))
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    }
    if (smartList === 'week') {
      return calendarEntries
        .filter((e) => e.date <= weekEndDate && (!e.endDate ? e.date >= today : e.endDate >= today))
        .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    }
    return []
  })()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          <Plus size={16} />
          {t('page.addTask')}
        </button>
      </div>

      {smartList !== 'inbox' && (
        <div className="mb-6 flex gap-1 border-b border-gray-100 dark:border-racing-800">
          <Link
            to="/tasks"
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              smartList !== 'completed' && smartList !== 'someday'
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-racing-200'
            }`}
          >
            {t('page.tabs.tasks')}
          </Link>
          <Link
            to="/tasks/someday"
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              smartList === 'someday'
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-racing-200'
            }`}
          >
            <Archive size={14} />
            {t('page.tabs.someday')}
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
            {t('page.tabs.completed')}
          </Link>
        </div>
      )}

      {smartList !== 'inbox' && (
        <div className="mb-5 flex flex-col gap-3">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Aufgaben durchsuchen..."
              className="w-full rounded-xl border border-gray-100 bg-white pl-9 pr-9 py-2 text-sm outline-none focus:border-accent dark:border-racing-800 dark:bg-racing-900/60 transition-all shadow-sm"
            />
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Project Pills */}
          {relevantBoards.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1.5 flex-shrink-0">Projekte:</span>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  selectedProject === null
                    ? 'bg-accent text-white shadow-sm hover:brightness-105'
                    : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-racing-200 dark:hover:bg-white/[0.1]'
                }`}
              >
                Alle Projekte
              </button>
              {relevantBoards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => setSelectedProject(selectedProject === board.id ? null : board.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    selectedProject === board.id
                      ? 'text-white shadow-sm hover:brightness-105'
                      : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-racing-200 dark:hover:bg-white/[0.1]'
                  }`}
                  style={{
                    backgroundColor: selectedProject === board.id ? board.color : undefined,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: selectedProject === board.id ? 'white' : board.color }} />
                  {board.title}
                </button>
              ))}
            </div>
          )}

          {/* Tag Pills */}
          {allUniqueTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1.5 flex-shrink-0">Tags:</span>
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  selectedTag === null
                    ? 'bg-accent text-white shadow-sm hover:brightness-105'
                    : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-racing-200 dark:hover:bg-white/[0.1]'
                }`}
              >
                Alle Tags
              </button>
              {allUniqueTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                    selectedTag === tag
                      ? 'bg-accent text-white shadow-sm hover:brightness-105'
                      : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-racing-200 dark:hover:bg-white/[0.1]'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {smartList === 'inbox' ? (
        <div>
          {boardInvites.length === 0 && teamInvites.length === 0 && incoming.length === 0 && notifications.filter((n) => !n.read || n.type === 'birthday').length === 0 && (
            <p className="py-12 text-center text-sm text-gray-400">{t('page.inbox.allDone')}</p>
          )}

          {notifications.filter((n) => n.type === 'birthday').length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                🎂 {t('page.inbox.birthdaysToday')}
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
                        <Check size={13} /> {t('page.inbox.congratulated')}
                      </button>
                    ) : (
                      <span className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-400 dark:bg-racing-800">
                        <Check size={13} /> {t('page.tabs.completed')}
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
                  {t('page.inbox.notifications')}
                </h2>
                <button onClick={markAllRead} className="text-xs text-accent hover:underline">{t('page.inbox.markAllRead')}</button>
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
                {t('page.inbox.projectInvites')}
              </h2>
              <div className="flex flex-col gap-2">
                {boardInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: invite.boardColor }}>
                      {invite.boardTitle.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{invite.boardTitle}</p>
                      <p className="truncate text-xs text-gray-400">{t('page.inbox.from', { name: invite.fromUser.display_name })}</p>
                    </div>
                    <button onClick={() => acceptInvite(invite.id)} className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark">
                      <Check size={14} /> {t('page.inbox.accept')}
                    </button>
                    <button onClick={() => declineInvite(invite.id)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800">
                      <X size={14} /> {t('page.inbox.decline')}
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
                {t('page.inbox.teamInvites')}
              </h2>
              <div className="flex flex-col gap-2">
                {teamInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Users size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{invite.teamName}</p>
                      <p className="truncate text-xs text-gray-400">{t('page.inbox.from', { name: invite.fromUser.display_name })}</p>
                    </div>
                    <button onClick={() => acceptTeamInvite(invite.id)} className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark">
                      <Check size={14} /> {t('page.inbox.accept')}
                    </button>
                    <button onClick={() => declineTeamInvite(invite.id)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800">
                      <X size={14} /> {t('page.inbox.decline')}
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
                {t('page.inbox.taskInvites')}
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
                        {t('page.inbox.from', { name: share.fromUser.display_name })}
                        {share.task.due_date && ` · ${t('page.inbox.due', { date: formatFriendlyDate(share.task.due_date) })}`}
                      </p>
                    </div>
                    <PriorityBadge priority={share.suggestedPriority ?? share.task.priority} />
                    <button onClick={() => acceptShare(share.id)} className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark">
                      <Check size={14} /> {t('page.inbox.accept')}
                    </button>
                    <button onClick={() => declineShare(share.id)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800">
                      <X size={14} /> {t('page.inbox.decline')}
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
        <>
          {relevantEntries.length > 0 && (
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                🗓️ {smartList === 'today' ? 'Termine heute' : 'Termine diese Woche'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={showEntries}
                onClick={() => setShowEntries((v) => !v)}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${showEntries ? 'bg-[#34c759]' : 'bg-gray-200 dark:bg-racing-700'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${showEntries ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          )}
          {showEntries && relevantEntries.length > 0 && (
            <CalendarEntriesBlock entries={relevantEntries} label="" today={today} />
          )}
          <TaskList
            tasks={displayTasks}
            groupByDate={groupByDate}
            flat={smartList === 'completed'}
            emptyMessage={smartList === 'completed' ? t('page.noCompletedTasks') : t('list.noTasks')}
          />
        </>
      )}

      {showForm && (
        <TaskFormModal defaultDueDate={defaultDueDate} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}
