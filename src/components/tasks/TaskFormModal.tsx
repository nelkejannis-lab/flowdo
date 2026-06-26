import { useEffect, useState, useMemo, useRef } from 'react'
import { Plus, Trash2, Check, X, Moon, Repeat, Archive, Loader2, Pencil } from 'lucide-react'
import CommentSection from '../shared/CommentSection'
import { useTranslation } from 'react-i18next'
import Modal from '../layout/Modal'
import AttachmentsField from '../shared/AttachmentsField'
import { useTasksStore } from '../../store/tasksStore'
import { useToastStore } from '../../store/toastStore'
import { useFriendsStore } from '../../store/friendsStore'
import { useTaskSharesStore } from '../../store/taskSharesStore'
import { useCalendarEntriesStore } from '../../store/calendarEntriesStore'
import { useBoardsStore } from '../../store/boardsStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { isSupabaseConfigured } from '../../lib/supabase'
import { eachEntryDate } from '../../utils/events'
import { todayISO, parseNaturalDate } from '../../utils/date'
import type { Attachment, Priority, Task } from '../../types'
import { createId } from '../../utils/id'
import { useTaskTrayStore } from '../../store/taskTrayStore'
import { useAiSchedulerStore } from '../../store/aiSchedulerStore'

const quadrants: { urgent: boolean; important: boolean; labelKey: string; activeClass: string }[] = [
  { urgent: true, important: true, labelKey: 'form.quadrants.urgentImportant', activeClass: 'border-red-400 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  { urgent: false, important: true, labelKey: 'form.quadrants.notUrgentImportant', activeClass: 'border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  { urgent: true, important: false, labelKey: 'form.quadrants.urgentNotImportant', activeClass: 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  { urgent: false, important: false, labelKey: 'form.quadrants.notUrgentNotImportant', activeClass: 'border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
]

interface TaskFormModalProps {
  task?: Task
  defaultTitle?: string
  defaultDueDate?: string
  defaultPriority?: Priority
  defaultProjectId?: string
  defaultTags?: string[]
  defaultUrgent?: boolean
  defaultImportant?: boolean
  onClose: () => void
}

export default function TaskFormModal({
  task,
  defaultTitle,
  defaultDueDate,
  defaultPriority,
  defaultProjectId,
  defaultTags,
  defaultUrgent,
  defaultImportant,
  onClose,
}: TaskFormModalProps) {
  const { t } = useTranslation(['tasks', 'common'])
  const addTask = useTasksStore((s) => s.addTask)
  const updateTask = useTasksStore((s) => s.updateTask)
  const deleteTask = useTasksStore((s) => s.deleteTask)
  const addSubtask = useTasksStore((s) => s.addSubtask)
  const toggleSubtask = useTasksStore((s) => s.toggleSubtask)
  const deleteSubtask = useTasksStore((s) => s.deleteSubtask)
  const friends = useFriendsStore((s) => s.friends)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)
  const sendTask = useTaskSharesStore((s) => s.sendTask)
  const calendarEntries = useCalendarEntriesStore((s) => s.entries)
  const fetchCalendarEntries = useCalendarEntriesStore((s) => s.fetchEntries)
  const boards = useBoardsStore((s) => s.boards)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const addProjectTask = useProjectTasksStore((s) => s.addTask)
  const addProjectSubtask = useProjectTasksStore((s) => s.addSubtask)
  const toggleProjectSubtask = useProjectTasksStore((s) => s.toggleSubtask)
  const addAttachment = useTasksStore((s) => s.addAttachment)
  const removeAttachment = useTasksStore((s) => s.removeAttachment)
  const addProjectAttachment = useProjectTasksStore((s) => s.addAttachment)
  const removeProjectAttachment = useProjectTasksStore((s) => s.removeAttachment)
  const tasks = useTasksStore((s) => s.tasks)
  const projectTasks = useProjectTasksStore((s) => s.myTasks)

  const [isEditing, setIsEditing] = useState(!task)
  const currentTask = useMemo(() => {
    if (!task) return undefined
    return tasks.find((t) => t.id === task.id) || projectTasks.find((t) => t.id === task.id) || task
  }, [task, tasks, projectTasks])

  const [title, setTitle] = useState(task?.title ?? defaultTitle ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaultDueDate ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? defaultPriority ?? 'medium')
  const [newSubtask, setNewSubtask] = useState('')
  const [tags, setTags] = useState<string[]>(task?.tags ?? defaultTags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [urgent, setUrgent] = useState(task?.urgent ?? defaultUrgent ?? false)
  const [important, setImportant] = useState(task?.important ?? defaultImportant ?? false)
  const [evening, setEvening] = useState(task?.evening ?? false)
  const [someday, setSomeday] = useState(task?.someday ?? false)
  const [recurrence, setRecurrence] = useState<Task['recurrence']>(task?.recurrence)
  const [localSubtasks, setLocalSubtasks] = useState<string[]>([])
  const [assigneeId, setAssigneeId] = useState('')
  const [projectId, setProjectId] = useState(task?.boardId ?? defaultProjectId ?? '')
  const [shareMessage, setShareMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>(task?.attachments ?? [])
  const [parsingTitle, setParsingTitle] = useState(false)
  const lastParsedTitleRef = useRef('')

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchBoards()
      if (!task) {
        fetchFriends()
        fetchCalendarEntries()
      }
    }
  }, [fetchFriends, fetchCalendarEntries, fetchBoards, task])

  const relevantDate = dueDate || todayISO()
  const assigneeOnVacation =
    !!assigneeId &&
    calendarEntries.some(
      (entry) =>
        entry.ownerId === assigneeId &&
        entry.type === 'urlaub' &&
        eachEntryDate(entry).includes(relevantDate)
    )

  function addLocalSubtask() {
    if (newSubtask.trim()) {
      setLocalSubtasks([...localSubtasks, newSubtask.trim()])
      setNewSubtask('')
    }
  }

  function removeLocalSubtask(index: number) {
    setLocalSubtasks(localSubtasks.filter((_, i) => i !== index))
  }

  function addTag() {
    const value = tagInput.trim().replace(/^#/, '')
    if (value && !tags.includes(value)) {
      setTags([...tags, value])
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  async function handleTitleBlur() {
    if (task) return
    const input = title.trim()
    if (!input || input === lastParsedTitleRef.current || parsingTitle) return

    setParsingTitle(true)
    lastParsedTitleRef.current = input
    try {
      let parsed
      try {
        parsed = await useAiSchedulerStore.getState().parseTaskWithAi(input, boards)
      } catch (err) {
        console.error('AI parsing failed, falling back to local regex:', err)
        const parsedDate = parseNaturalDate(input)
        if (parsedDate && parsedDate.cleanedText && !dueDate && !someday) {
          setTitle(parsedDate.cleanedText)
          setDueDate(parsedDate.date)
        }
        return
      }

      setTitle(parsed.title)
      if (parsed.dueDate && !dueDate && !someday) setDueDate(parsed.dueDate)
      if (parsed.projectId && !projectId) setProjectId(parsed.projectId)
      if (parsed.priority && priority === 'medium') setPriority(parsed.priority)
      if (parsed.urgent && !urgent) setUrgent(true)
      if (parsed.important && !important) setImportant(true)
    } finally {
      setParsingTitle(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    if (task && projectId) {
      const board = boards.find((b) => b.id === projectId)
      setSending(true)
      setSendError(null)
      const result = await addProjectTask({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority,
        tags,
        urgent,
        important,
        boardId: projectId,
        columnId: board?.columns[0]?.id,
      })
      setSending(false)
      if (result.error) {
        setSendError(result.error)
        return
      }
      if (result.id) {
        for (const s of task.subtasks) {
          await addProjectSubtask(result.id, s.title)
        }
        if (task.subtasks.some((s) => s.completed)) {
          const { tasks: projectTasks } = useProjectTasksStore.getState()
          const newTask = projectTasks.find((t) => t.id === result.id)
          for (const s of task.subtasks.filter((s) => s.completed)) {
            const match = newTask?.subtasks.find((ns) => ns.title === s.title && !ns.completed)
            if (match) await toggleProjectSubtask(result.id, match.id)
          }
        }
      }
      const taskId = task.id
      deleteTask(taskId)
      useToastStore.getState().show({
        message: 'Aufgabe gelöscht',
        action: { label: 'Rückgängig', onClick: () => useTasksStore.getState().undoDelete(taskId) },
        duration: 5000,
      })
    } else if (task) {
      updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority,
        tags,
        urgent,
        important,
        evening,
        someday,
        recurrence,
      })
    } else if (projectId) {
      const board = boards.find((b) => b.id === projectId)
      setSending(true)
      setSendError(null)
      const result = await addProjectTask({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority,
        tags,
        urgent,
        important,
        boardId: projectId,
        columnId: board?.columns[0]?.id,
      })
      setSending(false)
      if (result.error) {
        setSendError(result.error)
        return
      }
      if (result.id) {
        for (const s of localSubtasks) {
          await addProjectSubtask(result.id, s)
        }
      }
    } else if (assigneeId) {
      setSending(true)
      setSendError(null)
      const err = await sendTask(assigneeId, {
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority,
        tags,
        urgent,
        important,
        message: shareMessage.trim() || undefined,
      })
      setSending(false)
      if (err) {
        setSendError(err)
        return
      }
    } else {
      const created = addTask({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority,
        tags,
        urgent,
        important,
        evening,
        someday,
        recurrence,
      })
      localSubtasks.forEach((s) => addSubtask(created.id, s))
    }
    useTaskTrayStore.getState().remove(task?.id || '')
    onClose()
  }

  function handleDelete() {
    if (task) {
      const taskId = task.id
      deleteTask(taskId)
      useTaskTrayStore.getState().remove(taskId)
      useToastStore.getState().show({
        message: 'Aufgabe gelöscht',
        action: { label: 'Rückgängig', onClick: () => useTasksStore.getState().undoDelete(taskId) },
        duration: 5000,
      })
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
      tags,
      urgent,
      important,
      evening,
      someday,
      recurrence,
      completed: task?.completed ?? false,
      subtasks: task ? task.subtasks : localSubtasks.map((s) => ({ id: createId(), title: s, completed: false })),
      attachments: task?.attachments ?? [],
      createdAt: task?.createdAt ?? new Date().toISOString(),
    }
    useTaskTrayStore.getState().minimize({
      id: currentTaskId,
      title: currentTaskObj.title,
      type: 'personal',
      task: currentTaskObj,
    })
    onClose()
  }

  // Get all unique tags currently used in tasks
  const allExistingTasks = useMemo(() => [...tasks, ...projectTasks], [tasks, projectTasks])
  const existingTags = useMemo(
    () => Array.from(new Set(allExistingTasks.flatMap((t) => t.tags || []))).filter(Boolean),
    [allExistingTasks]
  )
  const availableExistingTags = useMemo(
    () => existingTags.filter((tag) => !tags.includes(tag)),
    [existingTags, tags]
  )

  const filteredSuggestions = useMemo(() => {
    if (!tagInput.trim()) {
      return availableExistingTags.slice(0, 10)
    }
    const search = tagInput.toLowerCase().trim()
    return availableExistingTags.filter((tag) => tag.toLowerCase().includes(search)).slice(0, 10)
  }, [availableExistingTags, tagInput])

  if (!isEditing && currentTask) {
    const board = boards.find((b) => b.id === projectId)
    const priorityLabel = currentTask.priority === 'high' ? t('priority.high') : currentTask.priority === 'low' ? t('priority.low') : t('priority.medium')
    const quadrantLabel = quadrants.find((q) => q.urgent === currentTask.urgent && q.important === currentTask.important)?.labelKey

    return (
      <Modal
        title={t('form.titleEdit')}
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
              {t('common:buttons.edit') || 'Bearbeiten'}
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
                <span className="text-gray-400 font-medium">{t('form.dueDate')}</span>
                <span className="font-semibold">{currentTask.dueDate}</span>
              </div>
            )}
            <div className="flex flex-col gap-0.5 rounded-xl bg-gray-50 dark:bg-racing-950 border border-gray-100 dark:border-racing-850 p-2.5">
              <span className="text-gray-400 font-medium">{t('form.priority')}</span>
              <span className="font-semibold capitalize">{priorityLabel}</span>
            </div>
            {board && (
              <div className="flex flex-col gap-0.5 rounded-xl bg-gray-50 dark:bg-racing-950 border border-gray-100 dark:border-racing-850 p-2.5 col-span-2">
                <span className="text-gray-400 font-medium">{t('form.project')}</span>
                <span className="font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: board.color }} />
                  {board.title}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {currentTask.evening && (
              <span className="rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-2.5 py-1 text-xs font-semibold flex items-center gap-1">
                <Moon size={12} /> {t('form.tonight')}
              </span>
            )}
            {currentTask.recurrence && (
              <span className="rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-2.5 py-1 text-xs font-semibold flex items-center gap-1">
                <Repeat size={12} /> {t(`form.repeat${currentTask.recurrence.charAt(0).toUpperCase() + currentTask.recurrence.slice(1)}` as any)}
              </span>
            )}
            {currentTask.someday && (
              <span className="rounded-full bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 px-2.5 py-1 text-xs font-semibold flex items-center gap-1">
                <Archive size={12} /> {t('form.someday')}
              </span>
            )}
            {quadrantLabel && (
              <span className="rounded-full bg-gray-100 text-gray-700 dark:bg-racing-800 dark:text-racing-200 px-2.5 py-1 text-xs font-semibold">
                {t(quadrantLabel)}
              </span>
            )}
          </div>

          {currentTask.tags && currentTask.tags.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-500 mb-1 block">{t('form.tags')}</span>
              <div className="flex flex-wrap gap-1.5">
                {currentTask.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-black/[0.04] text-gray-600 dark:bg-white/[0.06] dark:text-racing-200 px-2.5 py-0.5 text-xs font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Subtasks */}
          {currentTask.subtasks && currentTask.subtasks.length > 0 && (
            <div className="border-t border-gray-100 dark:border-racing-850 pt-3">
              <span className="text-xs font-medium text-gray-500 mb-2 block">{t('form.subtasks')}</span>
              <div className="flex flex-col gap-1.5">
                {currentTask.subtasks.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 py-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentTask.boardId) toggleProjectSubtask(currentTask.id, s.id)
                        else toggleSubtask(currentTask.id, s.id)
                      }}
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                        s.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-racing-600'
                      }`}
                    >
                      {s.completed && <Check size={10} />}
                    </button>
                    <span className={`text-sm ${s.completed ? 'text-gray-400 line-through' : ''}`}>
                      {s.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="border-t border-gray-100 dark:border-racing-850 pt-3">
              <span className="text-xs font-medium text-gray-500 mb-2 block">Anhänge</span>
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
      title={task ? t('form.titleEdit') : t('form.titleNew')}
      onClose={onClose}
      onMinimize={handleMinimize}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            disabled={parsingTitle}
            placeholder={parsingTitle ? "Analysiere mit KI..." : t('form.titlePlaceholder')}
            className="w-full rounded-lg border border-gray-200 bg-transparent pl-3 pr-9 py-2 text-sm font-medium focus:border-accent focus:outline-none dark:border-racing-700 disabled:opacity-75"
          />
          {parsingTitle && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 size={16} className="animate-spin text-accent" />
            </div>
          )}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('form.descriptionPlaceholder')}
          rows={2}
          className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.dueDate')}</label>
            <input
              type="date"
              value={dueDate}
              disabled={someday}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50 dark:border-racing-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.priority')}</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            >
              <option value="low">{t('priority.low')}</option>
              <option value="medium">{t('priority.medium')}</option>
              <option value="high">{t('priority.high')}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEvening((v) => !v)}
            disabled={someday}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              evening
                ? 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-racing-700 dark:text-racing-200'
            }`}
          >
            <Moon size={13} />
            {t('form.tonight')}
          </button>

          <div className="relative">
            <select
              value={recurrence ?? ''}
              onChange={(e) => setRecurrence((e.target.value || undefined) as Task['recurrence'])}
              className={`appearance-none rounded-lg border py-1.5 pl-7 pr-2.5 text-xs font-medium focus:outline-none ${
                recurrence
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'border-gray-200 bg-transparent text-gray-500 dark:border-racing-700 dark:text-racing-200'
              }`}
            >
              <option value="">{t('form.repeatPlaceholder')}</option>
              <option value="daily">{t('form.repeatDaily')}</option>
              <option value="weekly">{t('form.repeatWeekly')}</option>
              <option value="monthly">{t('form.repeatMonthly')}</option>
            </select>
            <Repeat size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" />
          </div>

          <button
            type="button"
            onClick={() => {
              setSomeday((v) => !v)
              if (!someday) {
                setDueDate('')
                setEvening(false)
              }
            }}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              someday
                ? 'border-violet-400 bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-racing-700 dark:text-racing-200'
            }`}
          >
            <Archive size={13} />
            {t('form.someday')}
          </button>
        </div>

        {boards.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.project')}</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            >
              <option value="">{t('form.noProject')}</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.title}
                </option>
              ))}
            </select>
            {task && projectId && (
              <p className="mt-1 text-xs text-gray-400">
                {t('form.movedToProjectHint')}
              </p>
            )}
          </div>
        )}

        {!task && !projectId && friends.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.assignTo')}</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            >
              <option value="">{t('form.myself')}</option>
              {friends.map((f) => (
                <option key={f.profile.id} value={f.profile.id}>
                  {f.profile.display_name} (@{f.profile.username})
                </option>
              ))}
            </select>
            {assigneeId && (
              <>
                <p className="mt-1 text-xs text-gray-400">
                  {t('form.shareHint', { name: friends.find((f) => f.profile.id === assigneeId)?.profile.display_name })}
                </p>
                <div className="mt-2">
                  <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.shareMessage')}</label>
                  <textarea
                    value={shareMessage}
                    onChange={(e) => setShareMessage(e.target.value)}
                    placeholder={t('form.shareMessagePlaceholder')}
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                  />
                </div>
              </>
            )}
            {assigneeOnVacation && (
              <p className="mt-1 text-xs text-amber-500">
                ⚠️ {dueDate
                  ? t('form.assigneeOnVacationDueDate', { name: friends.find((f) => f.profile.id === assigneeId)?.profile.display_name })
                  : t('form.assigneeOnVacation', { name: friends.find((f) => f.profile.id === assigneeId)?.profile.display_name })}
              </p>
            )}
            {sendError && <p className="mt-1 text-xs text-red-500">{sendError}</p>}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.tags')}</label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5 dark:border-racing-700">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-racing-800 dark:text-racing-100"
              >
                #{tag}
                <button type="button" onClick={() => removeTag(tag)} className="text-gray-400 hover:text-red-500">
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag()
                }
              }}
              onBlur={addTag}
              placeholder={t('form.tagPlaceholder')}
              className="min-w-[120px] flex-1 bg-transparent py-0.5 text-sm focus:outline-none"
            />
          </div>
          {filteredSuggestions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-semibold text-gray-400 select-none uppercase tracking-wide mr-1">
                {tagInput.trim() ? 'Vorschläge:' : 'Häufig verwendet:'}
              </span>
              {filteredSuggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    if (!tags.includes(tag)) {
                      setTags([...tags, tag])
                    }
                    setTagInput('')
                  }}
                  className="rounded-full bg-black/[0.03] hover:bg-black/[0.07] dark:bg-white/[0.05] dark:hover:bg-white/[0.1] px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:text-racing-200 transition-colors"
                >
                  +{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.eisenhowerMatrix')}</label>
          <div className="grid grid-cols-2 gap-2">
            {quadrants.map((q) => {
              const active = q.urgent === urgent && q.important === important
              return (
                <button
                  type="button"
                  key={q.labelKey}
                  onClick={() => {
                    setUrgent(q.urgent)
                    setImportant(q.important)
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
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.subtasks')}</label>
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
              placeholder={t('form.addSubtask')}
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
          <AttachmentsField
            attachments={attachments}
            onUpload={async (file) => {
              const result = task.boardId
                ? await addProjectAttachment(task.id, file)
                : await addAttachment(task.id, file)
              if (result.attachment) setAttachments((prev) => [...prev, result.attachment as Attachment])
              return result
            }}
            onDelete={(attachmentId) => {
              setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
              if (task.boardId) removeProjectAttachment(task.id, attachmentId)
              else removeAttachment(task.id, attachmentId)
            }}
          />
        )}

        <div className="mt-2 flex items-center justify-between">
          {task ? (
            <button
              type="button"
              onClick={handleDelete}
              className="text-sm font-medium text-red-500 hover:underline"
            >
              {t('common:buttons.delete')}
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {task
              ? projectId
                ? sending
                  ? t('form.moving')
                  : t('common:buttons.save')
                : t('common:buttons.save')
              : projectId
                ? sending
                  ? t('form.creating')
                  : t('form.add')
                : assigneeId
                  ? sending
                    ? t('form.sending')
                    : t('form.send')
                  : t('form.add')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
