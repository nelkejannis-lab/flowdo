import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import { ArrowLeft, Building2, Globe, MessageSquare, Pencil, Plus, UserPlus, Users, X } from 'lucide-react'
import { useBoardsStore } from '../store/boardsStore'
import { useBoardInvitesStore } from '../store/boardInvitesStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import { useFriendsStore } from '../store/friendsStore'
import { useAuthStore } from '../store/authStore'
import { useCommentsStore } from '../store/commentsStore'
import KanbanColumn from '../components/boards/KanbanColumn'
import BoardFormModal from '../components/boards/BoardFormModal'
import ProjectTaskFormModal from '../components/boards/ProjectTaskFormModal'
import CommentSection from '../components/shared/CommentSection'
import type { Task } from '../types'
import { formatFriendlyDate, isOverdue } from '../utils/date'
import { isSupabaseConfigured } from '../lib/supabase'

type ProgressFilter = 'all' | 'mine'

export default function BoardDetailPage() {
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
  const fetchFriends = useFriendsStore((s) => s.fetchAll)
  const currentUserId = useAuthStore((s) => s.user?.id)

  const [editingBoard, setEditingBoard] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTaskColumnId, setNewTaskColumnId] = useState<string | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [invitedIds, setInvitedIds] = useState<string[]>([])
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all')
  const [showDiscussion, setShowDiscussion] = useState(false)
  const boardCommentCount = useCommentsStore((s) => boardId ? (s.comments[boardId] ?? []).length : 0)

  useEffect(() => {
    if (boards.length === 0) fetchBoards()
  }, [boards.length, fetchBoards])

  useEffect(() => {
    if (boardId) fetchTasks(boardId)
  }, [boardId, fetchTasks])

  useEffect(() => {
    fetchFriends()
  }, [fetchFriends])

  if (!board) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-gray-400">
        <p>Projekt nicht gefunden.</p>
        <button
          onClick={() => navigate('/projekte')}
          className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <ArrowLeft size={16} />
          Zurück zu Projekten
        </button>
      </div>
    )
  }

  const isOwner = board.ownerId === currentUserId

  const visibleTasks =
    progressFilter === 'mine'
      ? tasks.filter((t) => t.assignedTo === currentUserId || (!t.assignedTo && t.ownerId === currentUserId))
      : tasks

  const total = visibleTasks.length
  const done = visibleTasks.filter((t) => t.completed).length
  const progress = total === 0 ? 0 : Math.round((done / total) * 100)
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
        Projekte
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: board.color }} />
          <div>
            <h1 className="text-2xl font-semibold">{board.title}</h1>
            {board.description && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-racing-200">{board.description}</p>
            )}
            {board.responsibleUserId && (() => {
              const responsible = board.members.find((m) => m.userId === board.responsibleUserId)?.profile
              return responsible ? (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ backgroundColor: responsible.avatar_color }}
                  >
                    {responsible.display_name.slice(0, 2).toUpperCase()}
                  </span>
                  <span>Verantwortlich: <span className="font-medium text-gray-600 dark:text-racing-200">{responsible.display_name}</span></span>
                </div>
              ) : null
            })()}
            {(board.internalLaunch || board.externalLaunch) && (
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {board.internalLaunch && (
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-racing-200">
                    <Building2 size={12} />
                    Interner Launch: {formatFriendlyDate(board.internalLaunch)}
                  </span>
                )}
                {board.externalLaunch && (
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-racing-200">
                    <Globe size={12} />
                    Externer Launch: {formatFriendlyDate(board.externalLaunch)}
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
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Mitglieder</p>
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
                            {profile ? profile.display_name : 'Ich'}
                            {m.role === 'owner' && <span className="ml-1 text-xs text-gray-400">(Inhaber)</span>}
                          </span>
                          {isOwner && m.role !== 'owner' && (
                            <button
                              onClick={() => removeMember(board.id, m.userId)}
                              className="text-gray-300 hover:text-red-500"
                              title="Entfernen"
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
                      Hinzufügen
                    </p>
                    {availableFriends.length === 0 ? (
                      <p className="text-xs text-gray-400">Keine weiteren Kollegen verfügbar.</p>
                    ) : (
                      <div className="flex flex-col gap-1">
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
                              {invited && <span className="ml-auto text-xs text-gray-400">Eingeladen</span>}
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
            onClick={() => setEditingBoard(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
          >
            <Pencil size={14} />
            Bearbeiten
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
          {progress}% ({done}/{total})
        </span>
        {board.deadline && (
          <span className={`text-sm ${overdue ? 'font-medium text-red-500' : 'text-gray-400'}`}>
            Deadline: {formatFriendlyDate(board.deadline)}
          </span>
        )}
      </div>

      <div className="mb-6 flex items-center gap-1 rounded-lg border border-gray-200 p-1 dark:border-racing-700 w-fit">
        <button
          onClick={() => setProgressFilter('all')}
          className={`rounded-md px-3 py-1 text-xs font-medium ${
            progressFilter === 'all' ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
          }`}
        >
          Alle Beteiligten
        </button>
        <button
          onClick={() => setProgressFilter('mine')}
          className={`rounded-md px-3 py-1 text-xs font-medium ${
            progressFilter === 'mine' ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
          }`}
        >
          Nur ich
        </button>
      </div>

      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <DndContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={visibleTasks.filter((t) => t.columnId === column.id)}
                  onTaskClick={(task) => setEditingTask(task)}
                  onAddTask={() => setNewTaskColumnId(column.id)}
                  onRenameColumn={(title) => updateColumn(board.id, column.id, title)}
                  onDeleteColumn={() => deleteColumn(board.id, column.id)}
                />
              ))}
              <button
                onClick={() => addColumn(board.id, 'Neue Spalte')}
                className="flex h-fit w-72 flex-shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 dark:border-racing-800 dark:hover:border-racing-700"
              >
                <Plus size={14} />
                Spalte hinzufügen
              </button>
            </div>
          </DndContext>
        </div>

        {isSupabaseConfigured && showDiscussion && (
          <div className="w-72 flex-shrink-0">
            <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare size={14} />
                  Diskussion
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

      {editingBoard && <BoardFormModal board={board} onClose={() => setEditingBoard(false)} />}
      {editingTask && <ProjectTaskFormModal board={board} task={editingTask} onClose={() => setEditingTask(null)} />}
      {newTaskColumnId && (
        <ProjectTaskFormModal board={board} defaultColumnId={newTaskColumnId} onClose={() => setNewTaskColumnId(null)} />
      )}
    </div>
  )
}
