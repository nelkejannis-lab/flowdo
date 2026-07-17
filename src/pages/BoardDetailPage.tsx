import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { ArrowLeft, Building2, Check, ChevronDown, ChevronRight, ChevronLeft, Globe, LayoutDashboard, MessageSquare, Plus, Settings, UserPlus, Users, X, Trello, List, Calendar, GanttChart } from 'lucide-react'
import { useBoardsStore } from '../store/boardsStore'
import { useBoardInvitesStore } from '../store/boardInvitesStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import ProjectDashboard from '../components/boards/ProjectDashboard'
import ProjectTimeline from '../components/boards/ProjectTimeline'
import { useFriendsStore } from '../store/friendsStore'
import { useAuthStore } from '../store/authStore'
import { useCommentsStore } from '../store/commentsStore'
import KanbanColumn from '../components/boards/KanbanColumn'
import BoardSettingsModal from '../components/boards/BoardSettingsModal'
import ProjectTaskFormModal from '../components/boards/ProjectTaskFormModal'
import CommentSection from '../components/shared/CommentSection'
import CalendarEntryFormModal from '../components/calendar/CalendarEntryFormModal'
import type { CalendarEntry, Task } from '../types'
import { formatFriendlyDate, isOverdue, toISODate } from '../utils/date'
import { isSupabaseConfigured } from '../lib/supabase'
import { useSettingsStore } from '../store/settingsStore'
import { useCalendarEntriesStore } from '../store/calendarEntriesStore'
import { format, addMonths, subMonths } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import MonthView from '../components/calendar/MonthView'
import TaskItem from '../components/tasks/TaskItem'

type ProgressFilter = 'all' | 'mine'

type ProjectView = 'overview' | 'board' | 'calendar' | 'list' | 'timeline'

export default function BoardDetailPage() {
  const { t, i18n } = useTranslation('boards')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const { boardId } = useParams()
  const navigate = useNavigate()
  const board = useBoardsStore((s) => s.boards.find((b) => b.id === boardId))
  const boards = useBoardsStore((s) => s.boards)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const removeMember = useBoardsStore((s) => s.removeMember)
  const inviteMember = useBoardInvitesStore((s) => s.inviteMember)

  const tasks = useProjectTasksStore((s) => s.tasks)
  const fetchTasks = useProjectTasksStore((s) => s.fetchTasks)
  const moveTaskToColumn = useProjectTasksStore((s) => s.moveTaskToColumn)
  const addColumn = useBoardsStore((s) => s.addColumn)
  const updateColumn = useBoardsStore((s) => s.updateColumn)
  const deleteColumn = useBoardsStore((s) => s.deleteColumn)

  const friends = useFriendsStore((s) => s.friends)
  const searchAllProfiles = useFriendsStore((s) => s.searchAllProfiles)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)
  const currentUserId = useAuthStore((s) => s.user?.id)

  const addTask = useProjectTasksStore((s) => s.addTask)
  const updateTask = useProjectTasksStore((s) => s.updateTask)
  const deleteTask = useProjectTasksStore((s) => s.deleteTask)
  const toggleTaskCompleted = useProjectTasksStore((s) => s.toggleTaskCompleted)

  const [activeView, setActiveView] = useState<ProjectView>('overview')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [newTaskDate, setNewTaskDate] = useState<string | null>(null)
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null)
  const [entryFormDate, setEntryFormDate] = useState<string | undefined>()

  const calendarEntries = useCalendarEntriesStore((s) => s.entries)
  const fetchCalendarEntries = useCalendarEntriesStore((s) => s.fetchEntries)

  const [showSettings, setShowSettings] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTaskColumnId, setNewTaskColumnId] = useState<string | null>(null)
  const [todoInput, setTodoInput] = useState('')
  const [todosOpen, setTodosOpen] = useState(true)
  const [showMembers, setShowMembers] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string; avatar_color: string }[]>([])
  const [memberError, setMemberError] = useState<string | null>(null)
  const [invitedIds, setInvitedIds] = useState<string[]>([])
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all')
  const hideCompletedInBoard = useSettingsStore((s) => s.hideCompletedTasks)
  const toggleHideCompletedTasks = useSettingsStore((s) => s.toggleHideCompletedTasks)
  const [showDiscussion, setShowDiscussion] = useState(false)
  const boardCommentCount = useCommentsStore((s) => boardId ? (s.comments[boardId] ?? []).length : 0)

  useEffect(() => {
    if (boards.length === 0) fetchBoards()
  }, [boards.length, fetchBoards])

  const subscribeToBoard = useProjectTasksStore((s) => s.subscribeToBoard)
  const isBlocked = useProjectTasksStore((s) => s.isBlocked)

  useEffect(() => {
    if (boardId) fetchTasks(boardId)
  }, [boardId, fetchTasks])

  useEffect(() => {
    if (!boardId || !isSupabaseConfigured) return
    return subscribeToBoard(boardId)
  }, [boardId, subscribeToBoard])

  useEffect(() => {
    if (isSupabaseConfigured) fetchCalendarEntries()
  }, [fetchCalendarEntries])

  useEffect(() => {
    fetchFriends()
  }, [fetchFriends])

  const projectCalendarEntries = calendarEntries.filter((e) => e.boardId === boardId && e.type === 'termin')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  if (!board) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-gray-400">
        <p>{t('detail.notFound')}</p>
        <button
          onClick={() => navigate('/projekte')}
          className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <ArrowLeft size={16} />
          {t('detail.backToProjects')}
        </button>
      </div>
    )
  }

  const isOwner = board.ownerId === currentUserId

  const visibleTasks =
    progressFilter === 'mine'
      ? tasks.filter((t) =>
          t.assignedTo === currentUserId
          || t.assigneeIds?.includes(currentUserId ?? '')
          || (!t.assignedTo && !t.assigneeIds?.length && t.ownerId === currentUserId)
        )
      : tasks

  const total = visibleTasks.length
  const done = visibleTasks.filter((t) => t.completed).length
  const progress = total === 0 ? 0 : Math.round((done / total) * 100)
  const kanbanTasks = hideCompletedInBoard ? visibleTasks.filter((t) => !t.completed) : visibleTasks
  const overdue = isOverdue(board.deadline)

  const availableFriends = friends.filter(
    (f) => f.profile.id !== board.ownerId && !board.members.some((m) => m.userId === f.profile.id)
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || !board) return
    const columnId = String(over.id)
    if (board.columns.some((c) => c.id === columnId)) {
      moveTaskToColumn(String(active.id), board.id, columnId)
    }
  }

  async function handleAddMember(userId: string) {
    if (!board) return
    setMemberError(null)
    const err = await inviteMember(board.id, board.title, board.color, userId)
    if (err) setMemberError(err)
    else setInvitedIds((prev) => [...prev, userId])
  }

  return (
    <div>
      <button
        onClick={() => navigate('/projekte')}
        className="mb-3 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-white"
      >
        <ArrowLeft size={14} />
        {t('detail.projects')}
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: board.color }} />
          <div>
            <h1 className="text-2xl font-semibold">{board.title}</h1>
            {board.description && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-racing-200">{board.description}</p>
            )}
            {board.responsibleProfile && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs text-gray-400">{t('detail.responsible')}</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: board.responsibleProfile.avatar_color }}
                  >
                    {board.responsibleProfile.display_name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium">{board.responsibleProfile.display_name}</span>
                </div>
              </div>
            )}
            {(board.internalLaunch || board.externalLaunch) && (
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {board.internalLaunch && (
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-racing-200">
                    <Building2 size={12} />
                    {t('detail.internalLaunch', { date: formatFriendlyDate(board.internalLaunch) })}
                  </span>
                )}
                {board.externalLaunch && (
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-racing-200">
                    <Globe size={12} />
                    {t('detail.externalLaunch', { date: formatFriendlyDate(board.externalLaunch) })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSupabaseConfigured && (
            <button
              onClick={() => setShowDiscussion((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                showDiscussion
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800'
              }`}
            >
              <MessageSquare size={15} />
              {boardCommentCount > 0 && <span className="text-xs">{boardCommentCount}</span>}
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowMembers((s) => !s)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
            >
              <Users size={14} />
              {board.members.length + 1}
            </button>
            {showMembers && (
              <div className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-gray-100 bg-white p-3 shadow-lg dark:border-racing-800 dark:bg-racing-900">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('detail.members')}</p>
                <div className="flex flex-col gap-1.5">
                  {[{ userId: board.ownerId, role: 'owner' as const, profile: undefined }, ...board.members].map(
                    (m) => {
                      const profile = m.profile
                      return (
                        <div key={m.userId} className="flex items-center gap-2 text-sm">
                          <span
                            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                            style={{ backgroundColor: profile?.avatar_color ?? '#9CA3AF' }}
                          >
                            {profile ? profile.display_name.slice(0, 2).toUpperCase() : '??'}
                          </span>
                          <span className="flex-1 truncate">
                            {profile ? profile.display_name : t('detail.me')}
                            {m.role === 'owner' && <span className="ml-1 text-xs text-gray-400">{t('detail.owner')}</span>}
                          </span>
                          {profile && (
                            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-racing-800">
                              {tasks.filter((tk) => !tk.completed && (tk.assignedTo === m.userId || tk.ownerId === m.userId)).length}
                            </span>
                          )}
                          {isOwner && m.role !== 'owner' && (
                            <button
                              onClick={() => removeMember(board.id, m.userId)}
                              className="text-gray-300 hover:text-red-500"
                              title={t('detail.remove')}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      )
                    }
                  )}
                </div>

                {isOwner && (
                  <div className="mt-3 border-t border-gray-100 pt-2 dark:border-racing-800">
                    <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      <UserPlus size={12} />
                      {t('detail.addMember')}
                    </p>
                    {availableFriends.length === 0 && searchResults.length === 0 ? (
                      <p className="text-xs text-gray-400">{t('detail.noFriendsAvailable')}</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <input
                          value={memberSearch}
                          onChange={async (e) => {
                            const q = e.target.value
                            setMemberSearch(q)
                            if (q.length >= 2) {
                              const results = await searchAllProfiles(q)
                              setSearchResults(results.map((p) => ({ id: p.id, display_name: p.display_name, avatar_color: p.avatar_color })))
                            } else setSearchResults([])
                          }}
                          placeholder={t('detail.searchColleagues')}
                          className="mb-1 w-full rounded-lg border border-gray-200 px-2 py-1 text-xs dark:border-racing-700"
                        />
                        {searchResults.filter((p) => !board.members.some((m) => m.userId === p.id) && p.id !== board.ownerId).map((p) => (
                          <button key={p.id} onClick={() => handleAddMember(p.id)}
                            className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-gray-50 dark:hover:bg-racing-800">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: p.avatar_color }}>
                              {p.display_name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="truncate">{p.display_name}</span>
                          </button>
                        ))}
                        {availableFriends.map((f) => {
                          const invited = invitedIds.includes(f.profile.id)
                          return (
                            <button
                              key={f.profile.id}
                              onClick={() => handleAddMember(f.profile.id)}
                              disabled={invited}
                              className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-gray-50 disabled:cursor-default disabled:opacity-60 dark:hover:bg-racing-800"
                            >
                              <span
                                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                style={{ backgroundColor: f.profile.avatar_color }}
                              >
                                {f.profile.display_name.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="truncate">{f.profile.display_name}</span>
                              {invited && <span className="ml-auto text-xs text-gray-400">{t('detail.invited')}</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {memberError && <p className="mt-1 text-xs text-red-500">{memberError}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
          >
            <Settings size={14} />
            {t('settings.open')}
          </button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div className="h-2 w-48 overflow-hidden rounded-full bg-gray-100 dark:bg-racing-800">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: board.color }}
          />
        </div>
        <span className="text-sm font-medium text-gray-500 dark:text-racing-200">
          {t('detail.progress', { percent: progress, done, total })}
        </span>
        {board.deadline && (
          <span className={`text-sm ${overdue ? 'font-medium text-red-500' : 'text-gray-400'}`}>
            {t('detail.deadline', { date: formatFriendlyDate(board.deadline) })}
          </span>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {/* Left: View Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1 dark:border-racing-700 bg-white dark:bg-racing-900">
          <button
            onClick={() => setActiveView('overview')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeView === 'overview' ? 'bg-accent text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
            }`}
          >
            <LayoutDashboard size={13} />
            {t('detail.tabDashboard')}
          </button>
          <button
            onClick={() => setActiveView('board')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeView === 'board' ? 'bg-accent text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
            }`}
          >
            <Trello size={13} />
            {t('detail.tabBoard')}
          </button>
          <button
            onClick={() => setActiveView('calendar')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeView === 'calendar' ? 'bg-accent text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
            }`}
          >
            <Calendar size={13} />
            {t('detail.tabCalendar')}
          </button>
          <button
            onClick={() => setActiveView('list')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeView === 'list' ? 'bg-accent text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
            }`}
          >
            <List size={13} />
            {t('detail.tabList')}
          </button>
          <button
            onClick={() => setActiveView('timeline')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeView === 'timeline' ? 'bg-accent text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
            }`}
          >
            <GanttChart size={13} />
            {t('detail.tabTimeline')}
          </button>
        </div>

        {/* Right: Filters */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1 dark:border-racing-700 bg-white dark:bg-racing-900">
          <button
            onClick={() => setProgressFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              progressFilter === 'all' ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
            }`}
          >
            {t('detail.filterAll')}
          </button>
          <button
            onClick={() => setProgressFilter('mine')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              progressFilter === 'mine' ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
            }`}
          >
            {t('detail.filterMine')}
          </button>
          <button
            onClick={toggleHideCompletedTasks}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              hideCompletedInBoard ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
            }`}
          >
            {t('detail.hideCompleted')}
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          {activeView === 'board' && (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {board.columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    tasks={kanbanTasks.filter((t) => t.columnId === column.id)}
                    onTaskClick={(task) => setEditingTask(task)}
                    onAddTask={() => setNewTaskColumnId(column.id)}
                    onRenameColumn={(title) => updateColumn(board.id, column.id, title)}
                    onDeleteColumn={() => deleteColumn(board.id, column.id)}
                  />
                ))}
                <button
                  onClick={() => addColumn(board.id, t('detail.newColumnTitle'))}
                  className="flex h-fit w-72 flex-shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 dark:border-racing-800 dark:hover:border-racing-700"
                >
                  <Plus size={14} />
                  {t('detail.addColumn')}
                </button>
              </div>
            </DndContext>
          )}

          {activeView === 'list' && (
            <div className="space-y-6">
              {board.columns.map((column) => {
                const colTasks = kanbanTasks.filter((t) => t.columnId === column.id)
                return (
                  <div key={column.id} className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-racing-100">
                        {column.title} <span className="text-xs text-gray-400">({colTasks.length})</span>
                      </h3>
                      <button
                        onClick={() => setNewTaskColumnId(column.id)}
                        className="flex items-center gap-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:bg-racing-800 dark:text-racing-200"
                      >
                        <Plus size={12} />
                        {t('kanban.addTask')}
                      </button>
                    </div>
                    {colTasks.length === 0 ? (
                      <p className="text-center text-xs text-gray-400 py-3">{t('todos.noTasksInColumn')}</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {colTasks.map((task) => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            showBoard={false}
                            onClick={() => setEditingTask(task)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {activeView === 'overview' && (
            <ProjectDashboard
              board={board}
              tasks={tasks}
              progressFilter={progressFilter}
              onOpenSettings={() => setShowSettings(true)}
              onAddTask={() => setNewTaskColumnId(board.columns[0]?.id ?? '')}
              onTaskClick={(task) => setEditingTask(task)}
              onSwitchToBoard={() => setActiveView('board')}
            />
          )}

          {activeView === 'timeline' && (
            <ProjectTimeline
              board={board}
              tasks={visibleTasks}
              onTaskClick={(task) => setEditingTask(task)}
              onUpdateTask={updateTask}
            />
          )}

          {activeView === 'calendar' && (
            <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCalendarDate((d) => subMonths(d, 1))}
                    className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <h2 className="min-w-[150px] text-lg font-semibold capitalize text-center">
                    {format(calendarDate, 'MMMM yyyy', { locale: dateLocale })}
                  </h2>
                  <button
                    onClick={() => setCalendarDate((d) => addMonths(d, 1))}
                    className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={() => setCalendarDate(new Date())}
                    className="ml-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
                  >
                    {t('todos.today')}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400">{t('todos.calendarHint')}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEntry(null)
                      setEntryFormDate(toISODate(new Date()))
                      setShowEntryForm(true)
                    }}
                    className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                  >
                    <Plus size={14} />
                    {t('detail.addMeeting', { defaultValue: 'Termin' })}
                  </button>
                </div>
              </div>
              <MonthView
                currentDate={calendarDate}
                tasks={kanbanTasks.filter((t) => t.dueDate)}
                events={[]}
                entries={projectCalendarEntries}
                onDayClick={(date) => {
                  setNewTaskDate(toISODate(date))
                  setNewTaskColumnId(board.columns[0]?.id || '')
                }}
                onTaskClick={(task) => setEditingTask(task)}
                onEventClick={() => {}}
                onEntryClick={(entry) => {
                  setEditingEntry(entry)
                  setShowEntryForm(true)
                }}
              />
            </div>
          )}
        </div>

        {isSupabaseConfigured && showDiscussion && (
          <div className="w-72 flex-shrink-0">
            <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare size={14} />
                  {t('detail.discussion')}
                </h3>
                <button onClick={() => setShowDiscussion(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              <CommentSection boardId={board.id} />
            </div>
          </div>
        )}
      </div>

      {/* Project Todos — tasks with no dueDate and no column (project-internal) */}
      {(() => {
        const todos = tasks.filter((t) => t.boardId === boardId && !t.dueDate && !t.columnId)
        const openTodos = todos.filter((t) => !t.completed)
        const doneTodos = todos.filter((t) => t.completed)
        return (
          <div className="mt-6 rounded-xl border border-gray-100 bg-white dark:border-racing-800 dark:bg-racing-900">
            <button
              onClick={() => setTodosOpen((o) => !o)}
              className="flex w-full items-center justify-between p-4"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Check size={15} className="text-accent" />
                Projekt-Todos
                {openTodos.length > 0 && (
                  <span className="rounded-full bg-accent/10 px-2 text-xs font-medium text-accent">{openTodos.length}</span>
                )}
              </span>
              {todosOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            </button>

            {todosOpen && (
              <div className="border-t border-gray-100 p-4 dark:border-racing-800">
                {/* Quick add */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!todoInput.trim() || !boardId) return
                    await addTask({ title: todoInput.trim(), boardId, columnId: undefined, priority: 'medium', urgent: false, important: false })
                    setTodoInput('')
                  }}
                  className="mb-3 flex items-center gap-2"
                >
                  <input
                    value={todoInput}
                    onChange={(e) => setTodoInput(e.target.value)}
                    placeholder={t('todos.addPlaceholder')}
                    className="flex-1 rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                  />
                  <button
                    type="submit"
                    disabled={!todoInput.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-40"
                  >
                    <Plus size={16} />
                  </button>
                </form>

                {/* Open todos */}
                <div className="flex flex-col gap-1">
                  {openTodos.map((todo) => (
                    <div key={todo.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-racing-800">
                      <button
                        onClick={() => toggleTaskCompleted(todo.id)}
                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-300 hover:border-accent dark:border-racing-600"
                      />
                      <span className="flex-1 text-sm">{todo.title}</span>
                      <button
                        onClick={() => deleteTask(todo.id)}
                        className="hidden text-gray-300 hover:text-red-500 group-hover:flex"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {openTodos.length === 0 && doneTodos.length === 0 && (
                    <p className="py-2 text-center text-xs text-gray-400">{t('todos.empty')}</p>
                  )}
                </div>

                {/* Done todos */}
                {doneTodos.length > 0 && (
                  <div className="mt-2 border-t border-gray-100 pt-2 dark:border-racing-800">
                    <button
                      onClick={toggleHideCompletedTasks}
                      className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:hover:text-racing-100"
                    >
                      {!hideCompletedInBoard ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      Erledigt ({doneTodos.length})
                    </button>
                    {!hideCompletedInBoard && doneTodos.map((todo) => (
                      <div key={todo.id} className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-50 dark:hover:bg-racing-800">
                        <button
                          onClick={() => toggleTaskCompleted(todo.id)}
                          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-accent bg-accent text-white"
                        >
                          <Check size={10} />
                        </button>
                        <span className="flex-1 text-sm text-gray-400 line-through">{todo.title}</span>
                        <button
                          onClick={() => deleteTask(todo.id)}
                          className="hidden text-gray-300 hover:text-red-500 group-hover:flex"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {showSettings && <BoardSettingsModal board={board} onClose={() => setShowSettings(false)} />}
      {editingTask && <ProjectTaskFormModal board={board} task={editingTask} onClose={() => setEditingTask(null)} />}
      {newTaskColumnId && (
        <ProjectTaskFormModal
          board={board}
          defaultColumnId={newTaskColumnId}
          defaultDueDate={newTaskDate ?? undefined}
          onClose={() => {
            setNewTaskColumnId(null)
            setNewTaskDate(null)
          }}
        />
      )}
      {showEntryForm && (
        <CalendarEntryFormModal
          entry={editingEntry ?? undefined}
          defaultDate={entryFormDate}
          defaultBoardId={boardId}
          onClose={() => {
            setShowEntryForm(false)
            setEditingEntry(null)
            setEntryFormDate(undefined)
          }}
        />
      )}
    </div>
  )
}
