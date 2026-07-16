import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Check, X, Lock, Pencil } from 'lucide-react'
import CommentSection from '../shared/CommentSection'
import { isSupabaseConfigured } from '../../lib/supabase'
import Modal from '../layout/Modal'
import AttachmentsField from '../shared/AttachmentsField'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import type { Attachment, Board, Priority, Task } from '../../types'
import { createId } from '../../utils/id'
import { useTaskTrayStore } from '../../store/taskTrayStore'
import { useSettingsStore } from '../../store/settingsStore'

const quadrants: { urgent: boolean; important: boolean; labelKey: string; activeClass: string }[] = [
  { urgent: true, important: true, labelKey: 'taskForm.quadrantUrgentImportant', activeClass: 'border-red-400 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  { urgent: false, important: true, labelKey: 'taskForm.quadrantNotUrgentImportant', activeClass: 'border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  { urgent: true, important: false, labelKey: 'taskForm.quadrantUrgentNotImportant', activeClass: 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  { urgent: false, important: false, labelKey: 'taskForm.quadrantNotUrgentNotImportant', activeClass: 'border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
]

interface ProjectTaskFormModalProps {
  board: Board
  task?: Task
  defaultColumnId?: string
  defaultDueDate?: string
  onClose: () => void
}

export default function ProjectTaskFormModal({ board, task, defaultColumnId, defaultDueDate, onClose }: ProjectTaskFormModalProps) {
  const { t } = useTranslation(['boards', 'common', 'tasks'])
  const addTask = useProjectTasksStore((s) => s.addTask)
  const updateTask = useProjectTasksStore((s) => s.updateTask)
  const deleteTask = useProjectTasksStore((s) => s.deleteTask)
  const addSubtask = useProjectTasksStore((s) => s.addSubtask)
  const toggleSubtask = useProjectTasksStore((s) => s.toggleSubtask)
  const deleteSubtask = useProjectTasksStore((s) => s.deleteSubtask)
  const addAttachment = useProjectTasksStore((s) => s.addAttachment)
  const removeAttachment = useProjectTasksStore((s) => s.removeAttachment)
  const addDependency = useProjectTasksStore((s) => s.addDependency)
  const removeDependency = useProjectTasksStore((s) => s.removeDependency)
  const requireTaskEstimate = useSettingsStore((s) => s.requireTaskEstimate)
  const allBoardTasks = useProjectTasksStore((s) => s.tasks)

  const [isEditing, setIsEditing] = useState(!task)
  const currentTask = useMemo(() => {
    if (!task) return undefined
    return allBoardTasks.find((t) => t.id === task.id) || task
  }, [task, allBoardTasks])

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaultDueDate ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? '')
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds ?? (task?.assignedTo ? [task.assignedTo] : []))
  const [urgent, setUrgent] = useState(task?.urgent ?? false)
  const [important, setImportant] = useState(task?.important ?? false)
  const [matrixPlaced, setMatrixPlaced] = useState(
    task
      ? typeof task.matrixPlaced === 'boolean'
        ? task.matrixPlaced
        : Boolean(task.urgent || task.important)
      : false
  )
  const [startTime, setStartTime] = useState(task?.startTime ?? '')
  const [estimatedMinutes, setEstimatedMinutes] = useState(task?.estimatedMinutes?.toString() ?? '')
  const [statusNote, setStatusNote] = useState(task?.statusNote ?? '')
  const [newSubtask, setNewSubtask] = useState('')
  const [localSubtasks, setLocalSubtasks] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>(task?.attachments ?? [])

  function addLocalSubtask() {
    if (newSubtask.trim()) {
      setLocalSubtasks([...localSubtasks, newSubtask.trim()])
      setNewSubtask('')
    }
  }

  function removeLocalSubtask(index: number) {
    setLocalSubtasks(localSubtasks.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    setError(null)
    const parsedEstimatedMinutes = estimatedMinutes.trim() ? Number(estimatedMinutes) : undefined

    if (requireTaskEstimate && (!parsedEstimatedMinutes || parsedEstimatedMinutes <= 0)) {
      setError(t('tasks:form.estimateRequired'))
      setSaving(false)
      return
    }

    if (task) {
      await updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority,
        urgent,
        important,
        matrixPlaced,
        assignedTo: assigneeIds[0] || assignedTo || undefined,
        assigneeIds: assigneeIds.length ? assigneeIds : undefined,
        startTime: startTime || undefined,
        estimatedMinutes: parsedEstimatedMinutes,
        statusNote: statusNote.trim() || undefined,
      })
      setSaving(false)
    } else {
      const result = await addTask({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority,
        urgent,
        important,
        matrixPlaced,
        boardId: board.id,
        columnId: defaultColumnId ?? board.columns[0]?.id,
        assignedTo: assigneeIds[0] || assignedTo || undefined,
        assigneeIds: assigneeIds.length ? assigneeIds : undefined,
        startTime: startTime || undefined,
        estimatedMinutes: parsedEstimatedMinutes,
        statusNote: statusNote.trim() || undefined,
      })
      setSaving(false)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.id) {
        for (const s of localSubtasks) {
          await addSubtask(result.id, s)
        }
      }
    }
    useTaskTrayStore.getState().remove(task?.id || '')
    onClose()
  }

  function handleDelete() {
    if (task) {
      deleteTask(task.id)
      useTaskTrayStore.getState().remove(task.id)
      onClose()
    }
  }

  function handleMinimize() {
    const currentTaskId = task?.id ?? createId()
    const currentTaskObj: Task = {
      id: currentTaskId,
      title: title.trim() || 'Unbenannte Aufgabe',
      description: description.trim() || undefined,
      dueDate: dueDate || undefined,
      priority,
      urgent,
      important,
      matrixPlaced,
      completed: task?.completed ?? false,
      tags: task?.tags ?? [],
      subtasks: task ? task.subtasks : localSubtasks.map((s) => ({ id: createId(), title: s, completed: false })),
      attachments: task?.attachments ?? [],
      boardId: board.id,
      columnId: task?.columnId ?? defaultColumnId ?? board.columns[0]?.id,
      assignedTo: assignedTo || undefined,
      createdAt: task?.createdAt ?? new Date().toISOString(),
    }
    useTaskTrayStore.getState().minimize({
      id: currentTaskId,
      title: currentTaskObj.title,
      type: 'project',
      boardId: board.id,
      task: currentTaskObj,
    })
    onClose()
  }

  if (!isEditing && currentTask) {
    const priorityLabel = currentTask.priority === 'high' ? t('taskForm.priorityHigh') : currentTask.priority === 'low' ? t('taskForm.priorityLow') : t('taskForm.priorityMedium')
    const quadrantLabel = quadrants.find((q) => q.urgent === currentTask.urgent && q.important === currentTask.important)?.labelKey
    const assigneeMember = board.members.find((m) => m.userId === currentTask.assignedTo)

    return (
      <Modal
        title={t('taskForm.editTask')}
        onClose={onClose}
        onMinimize={handleMinimize}
      >
        <div className="flex flex-col gap-4 text-gray-800 dark:text-racing-100">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold break-words flex-1 leading-snug">{currentTask.title}</h2>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark shadow-sm transition-all"
            >
              <Pencil size={12} />
              Bearbeiten
            </button>
          </div>

          {currentTask.description ? (
            <p className="text-sm text-gray-600 dark:text-racing-300 bg-gray-50 dark:bg-racing-950 p-3 rounded-xl whitespace-pre-wrap break-words border border-gray-100 dark:border-racing-850">
              {currentTask.description}
            </p>
          ) : (
            <p className="text-xs italic text-gray-400">Keine Beschreibung vorhanden</p>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            {currentTask.dueDate && (
              <div className="flex flex-col gap-0.5 rounded-xl bg-gray-50 dark:bg-racing-950 border border-gray-100 dark:border-racing-850 p-2.5">
                <span className="text-gray-400 font-medium">{t('taskForm.dueDate')}</span>
                <span className="font-semibold">{currentTask.dueDate}</span>
              </div>
            )}
            <div className="flex flex-col gap-0.5 rounded-xl bg-gray-50 dark:bg-racing-950 border border-gray-100 dark:border-racing-850 p-2.5">
              <span className="text-gray-400 font-medium">{t('taskForm.priority')}</span>
              <span className="font-semibold capitalize">{priorityLabel}</span>
            </div>
            {assigneeMember && (
              <div className="flex flex-col gap-0.5 rounded-xl bg-gray-50 dark:bg-racing-950 border border-gray-100 dark:border-racing-850 p-2.5 col-span-2">
                <span className="text-gray-400 font-medium">{t('taskForm.assignedTo')}</span>
                <span className="font-semibold">
                  {assigneeMember.profile.display_name} (@{assigneeMember.profile.username})
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {quadrantLabel && (
              <span className="rounded-full bg-gray-100 text-gray-700 dark:bg-racing-800 dark:text-racing-200 px-2.5 py-1 text-xs font-semibold">
                {t(quadrantLabel)}
              </span>
            )}
          </div>

          {/* Subtasks — viewable, toggleable, and addable directly here */}
          <div className="border-t border-gray-100 dark:border-racing-850 pt-3">
            <span className="text-xs font-medium text-gray-500 mb-2 block">{t('taskForm.subtasks')}</span>
            <div className="flex flex-col gap-1.5">
              {(currentTask.subtasks ?? []).map((s) => (
                <div key={s.id} className="group flex items-center gap-2 py-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSubtask(currentTask.id, s.id)}
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      s.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-racing-600'
                    }`}
                  >
                    {s.completed && <Check size={10} />}
                  </button>
                  <span className={`flex-1 text-sm ${s.completed ? 'text-gray-400 line-through' : ''}`}>
                    {s.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteSubtask(currentTask.id, s.id)}
                    className="text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder={t('taskForm.addSubtaskPlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSubtask.trim()) {
                    e.preventDefault()
                    addSubtask(currentTask.id, newSubtask.trim())
                    setNewSubtask('')
                  }
                }}
                className="flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newSubtask.trim()) return
                  addSubtask(currentTask.id, newSubtask.trim())
                  setNewSubtask('')
                }}
                className="rounded-lg bg-accent p-1.5 text-white hover:bg-accent-dark"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Status note */}
          {currentTask.statusNote && (
            <div className="border-t border-gray-100 dark:border-racing-850 pt-3">
              <span className="text-xs font-medium text-gray-500 mb-2 block">{t('taskForm.statusNote')}</span>
              <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-racing-200">{currentTask.statusNote}</p>
            </div>
          )}

          {/* Dependencies */}
          {currentTask.dependsOn && currentTask.dependsOn.length > 0 && (
            <div className="border-t border-gray-100 dark:border-racing-850 pt-3">
              <span className="text-xs font-medium text-gray-500 mb-2 block">{t('taskForm.dependsOn')}</span>
              <div className="flex flex-col gap-1.5">
                {currentTask.dependsOn.map((depId) => {
                  const dep = allBoardTasks.find((bt) => bt.id === depId)
                  if (!dep) return null
                  return (
                    <div key={depId} className="flex items-center gap-2 text-sm">
                      <span className={`h-2 w-2 rounded-full ${dep.completed ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                      <span className={`flex-1 ${dep.completed ? 'text-gray-400 line-through' : ''}`}>{dep.title}</span>
                      <span className="text-[10px] text-gray-400">({dep.completed ? 'Erledigt' : 'Ausstehend'})</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="border-t border-gray-100 dark:border-racing-850 pt-3">
              <span className="text-xs font-medium text-gray-500 mb-2 block">{t('common:attachments.label')}</span>
              <div className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-racing-950 dark:border-racing-800 hover:border-accent p-2 text-xs font-medium text-gray-600 dark:text-racing-200 transition-colors"
                  >
                    <span className="truncate max-w-[150px]">{a.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Comments Section inside task view */}
          {isSupabaseConfigured && (
            <div className="border-t border-gray-100 dark:border-racing-850 pt-3">
              <span className="text-xs font-medium text-gray-500 mb-2 block">Kommentare</span>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 dark:border-racing-850 p-2 bg-gray-50/50 dark:bg-racing-950/20">
                <CommentSection taskId={currentTask.id} />
              </div>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title={task ? t('taskForm.editTask') : t('taskForm.newTask')}
      onClose={onClose}
      onMinimize={handleMinimize}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('taskForm.titlePlaceholder')}
          className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-medium focus:border-accent focus:outline-none dark:border-racing-700"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('taskForm.descriptionPlaceholder')}
          rows={2}
          className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('taskForm.dueDate')}</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('taskForm.priority')}</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            >
              <option value="low">{t('taskForm.priorityLow')}</option>
              <option value="medium">{t('taskForm.priorityMedium')}</option>
              <option value="high">{t('taskForm.priorityHigh')}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('taskForm.startTime')}</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('taskForm.estimatedMinutes')}</label>
            <input
              type="number"
              min={0}
              step={5}
              placeholder={t('taskForm.estimatedMinutesPlaceholder')}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('taskForm.statusNote')}</label>
          <textarea
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            placeholder={t('taskForm.statusNotePlaceholder')}
            rows={2}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('taskForm.eisenhowerMatrix')}</label>
          <div className="grid grid-cols-2 gap-2">
            {quadrants.map((q) => {
              const active = matrixPlaced && q.urgent === urgent && q.important === important
              return (
                <button
                  type="button"
                  key={q.labelKey}
                  onClick={() => {
                    if (active) {
                      setUrgent(false)
                      setImportant(false)
                      setMatrixPlaced(false)
                    } else {
                      setUrgent(q.urgent)
                      setImportant(q.important)
                      setMatrixPlaced(true)
                    }
                  }}
                  className={`rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                    active ? q.activeClass : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-racing-700 dark:text-racing-200'
                  }`}
                >
                  {t(q.labelKey)}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('taskForm.assignedTo')}</label>
          <div className="flex flex-wrap gap-2">
            {board.members.map((m) => {
              const active = assigneeIds.includes(m.userId)
              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => setAssigneeIds((ids) =>
                    active ? ids.filter((id) => id !== m.userId) : [...ids, m.userId]
                  )}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    active ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 dark:bg-racing-800'
                  }`}
                >
                  {m.profile.display_name}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('taskForm.subtasks')}</label>
          <div className="flex flex-col gap-1">
            {task &&
              task.subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSubtask(task.id, s.id)}
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      s.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-racing-600'
                    }`}
                  >
                    {s.completed && <Check size={10} />}
                  </button>
                  <span className={`flex-1 text-sm ${s.completed ? 'text-gray-400 line-through' : ''}`}>
                    {s.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteSubtask(task.id, s.id)}
                    className="text-gray-300 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            {!task &&
              localSubtasks.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex h-4 w-4 flex-shrink-0 rounded-full border-2 border-gray-300 dark:border-racing-600" />
                  <span className="flex-1 text-sm">{s}</span>
                  <button
                    type="button"
                    onClick={() => removeLocalSubtask(i)}
                    className="text-gray-300 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (task) {
                    if (newSubtask.trim()) {
                      addSubtask(task.id, newSubtask.trim())
                      setNewSubtask('')
                    }
                  } else {
                    addLocalSubtask()
                  }
                }
              }}
              placeholder={t('taskForm.addSubtaskPlaceholder')}
              className="flex-1 rounded-lg border border-gray-200 bg-transparent px-3 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
            <button
              type="button"
              onClick={() => {
                if (task) {
                  if (newSubtask.trim()) {
                    addSubtask(task.id, newSubtask.trim())
                    setNewSubtask('')
                  }
                } else {
                  addLocalSubtask()
                }
              }}
              className="rounded-lg bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200 dark:bg-racing-800 dark:text-racing-100"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {task && (
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Lock size={12} />
              {t('taskForm.dependsOn')}
            </label>
            <div className="flex flex-col gap-1">
              {(task.dependsOn ?? []).map((depId) => {
                const dep = allBoardTasks.find((bt) => bt.id === depId)
                if (!dep) return null
                return (
                  <div key={depId} className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-racing-700">
                    <span className={`flex-1 ${dep.completed ? 'text-gray-400 line-through' : ''}`}>{dep.title}</span>
                    <button
                      type="button"
                      onClick={() => removeDependency(task.id, depId)}
                      className="text-gray-300 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) addDependency(task.id, e.target.value)
              }}
              className="mt-2 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            >
              <option value="">{t('taskForm.addDependency')}</option>
              {allBoardTasks
                .filter((bt) => bt.id !== task.id && !(task.dependsOn ?? []).includes(bt.id))
                .map((bt) => (
                  <option key={bt.id} value={bt.id}>
                    {bt.title}
                  </option>
                ))}
            </select>
          </div>
        )}

        {task && (
          <AttachmentsField
            attachments={attachments}
            onUpload={async (file) => {
              const result = await addAttachment(task.id, file)
              if (result.attachment) setAttachments((prev) => [...prev, result.attachment as Attachment])
              return result
            }}
            onDelete={(attachmentId) => {
              setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
              removeAttachment(task.id, attachmentId)
            }}
          />
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="mt-2 flex items-center justify-between">
          {task ? (
            <button
              type="button"
              onClick={handleDelete}
              className="text-sm font-medium text-red-500 hover:underline"
            >
              {t('taskForm.delete')}
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {task ? t('taskForm.save') : t('taskForm.add')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
