import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, X, Moon, Repeat, Archive } from 'lucide-react'
import Modal from '../layout/Modal'
import AttachmentsField from '../shared/AttachmentsField'
import { useTasksStore } from '../../store/tasksStore'
import { useFriendsStore } from '../../store/friendsStore'
import { useTaskSharesStore } from '../../store/taskSharesStore'
import { useCalendarEntriesStore } from '../../store/calendarEntriesStore'
import { useBoardsStore } from '../../store/boardsStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { isSupabaseConfigured } from '../../lib/supabase'
import { eachEntryDate } from '../../utils/events'
import { todayISO, parseNaturalDate } from '../../utils/date'
import type { Attachment, Priority, Task } from '../../types'

const quadrants: { urgent: boolean; important: boolean; label: string; activeClass: string }[] = [
  { urgent: true, important: true, label: 'Dringend & Wichtig', activeClass: 'border-red-400 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  { urgent: false, important: true, label: 'Nicht dringend & Wichtig', activeClass: 'border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  { urgent: true, important: false, label: 'Dringend & Unwichtig', activeClass: 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  { urgent: false, important: false, label: 'Nicht dringend & Unwichtig', activeClass: 'border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
]

interface TaskFormModalProps {
  task?: Task
  defaultDueDate?: string
  defaultUrgent?: boolean
  defaultImportant?: boolean
  onClose: () => void
}

export default function TaskFormModal({
  task,
  defaultDueDate,
  defaultUrgent,
  defaultImportant,
  onClose,
}: TaskFormModalProps) {
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

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaultDueDate ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [newSubtask, setNewSubtask] = useState('')
  const [tags, setTags] = useState<string[]>(task?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [urgent, setUrgent] = useState(task?.urgent ?? defaultUrgent ?? false)
  const [important, setImportant] = useState(task?.important ?? defaultImportant ?? false)
  const [evening, setEvening] = useState(task?.evening ?? false)
  const [someday, setSomeday] = useState(task?.someday ?? false)
  const [recurrence, setRecurrence] = useState<Task['recurrence']>(task?.recurrence)
  const [localSubtasks, setLocalSubtasks] = useState<string[]>([])
  const [assigneeId, setAssigneeId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>(task?.attachments ?? [])

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

  function handleTitleBlur() {
    if (dueDate || someday) return
    const parsed = parseNaturalDate(title)
    if (parsed && parsed.cleanedText) {
      setTitle(parsed.cleanedText)
      setDueDate(parsed.date)
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
      deleteTask(task.id)
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
    onClose()
  }

  function handleDelete() {
    if (task) {
      deleteTask(task.id)
      onClose()
    }
  }

  return (
    <Modal title={task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Was ist zu tun? (z. B. „Bericht morgen“)"
          className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-medium focus:border-accent focus:outline-none dark:border-racing-700"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschreibung (optional)"
          rows={2}
          className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Fällig am</label>
            <input
              type="date"
              value={dueDate}
              disabled={someday}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50 dark:border-racing-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Priorität</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            >
              <option value="low">Niedrig</option>
              <option value="medium">Mittel</option>
              <option value="high">Hoch</option>
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
            Heute Abend
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
              <option value="">Wiederholen…</option>
              <option value="daily">Täglich</option>
              <option value="weekly">Wöchentlich</option>
              <option value="monthly">Monatlich</option>
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
            Irgendwann
          </button>
        </div>

        {boards.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Projekt</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            >
              <option value="">Kein Projekt (persönlich)</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.title}
                </option>
              ))}
            </select>
            {task && projectId && (
              <p className="mt-1 text-xs text-gray-400">
                Diese Aufgabe wird in das Projekt verschoben und mit allen Mitgliedern geteilt.
              </p>
            )}
          </div>
        )}

        {!task && !projectId && friends.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Zuweisen an</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            >
              <option value="">Mich selbst</option>
              {friends.map((f) => (
                <option key={f.profile.id} value={f.profile.id}>
                  {f.profile.display_name} (@{f.profile.username})
                </option>
              ))}
            </select>
            {assigneeId && (
              <>
                <p className="mt-1 text-xs text-gray-400">
                  Diese Aufgabe wird an {friends.find((f) => f.profile.id === assigneeId)?.profile.display_name} gesendet
                  und erscheint dort in der Inbox.
                </p>
                <div className="mt-2">
                  <label className="mb-1 block text-xs font-medium text-gray-500">Nachricht dazu (optional)</label>
                  <textarea
                    value={shareMessage}
                    onChange={(e) => setShareMessage(e.target.value)}
                    placeholder={'z. B. "Bitte bis Freitag erledigen - danke!"'}
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                  />
                </div>
              </>
            )}
            {assigneeOnVacation && (
              <p className="mt-1 text-xs text-amber-500">
                ⚠️ {friends.find((f) => f.profile.id === assigneeId)?.profile.display_name} ist
                {dueDate ? ' am Fälligkeitsdatum' : ''} im Urlaub.
              </p>
            )}
            {sendError && <p className="mt-1 text-xs text-red-500">{sendError}</p>}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Tags</label>
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
              placeholder="Tag hinzufügen + Enter"
              className="min-w-[120px] flex-1 bg-transparent py-0.5 text-sm focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Eisenhower-Matrix</label>
          <div className="grid grid-cols-2 gap-2">
            {quadrants.map((q) => {
              const active = q.urgent === urgent && q.important === important
              return (
                <button
                  type="button"
                  key={q.label}
                  onClick={() => {
                    setUrgent(q.urgent)
                    setImportant(q.important)
                  }}
                  className={`rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                    active ? q.activeClass : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-racing-700 dark:text-racing-200'
                  }`}
                >
                  {q.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Unteraufgaben</label>
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
              placeholder="Unteraufgabe hinzufügen"
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
              Löschen
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
                  ? 'Verschiebe…'
                  : 'Speichern'
                : 'Speichern'
              : projectId
                ? sending
                  ? 'Erstelle…'
                  : 'Hinzufügen'
                : assigneeId
                  ? sending
                    ? 'Sende…'
                    : 'Senden'
                  : 'Hinzufügen'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
