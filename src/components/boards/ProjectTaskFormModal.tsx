import { useState } from 'react'
import { Plus, Trash2, Check, X } from 'lucide-react'
import Modal from '../layout/Modal'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import type { Board, Priority, Task } from '../../types'

const quadrants: { urgent: boolean; important: boolean; label: string; activeClass: string }[] = [
  { urgent: true, important: true, label: 'Dringend & Wichtig', activeClass: 'border-red-400 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  { urgent: false, important: true, label: 'Nicht dringend & Wichtig', activeClass: 'border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  { urgent: true, important: false, label: 'Dringend & Unwichtig', activeClass: 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  { urgent: false, important: false, label: 'Nicht dringend & Unwichtig', activeClass: 'border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
]

interface ProjectTaskFormModalProps {
  board: Board
  task?: Task
  defaultColumnId?: string
  onClose: () => void
}

export default function ProjectTaskFormModal({ board, task, defaultColumnId, onClose }: ProjectTaskFormModalProps) {
  const addTask = useProjectTasksStore((s) => s.addTask)
  const updateTask = useProjectTasksStore((s) => s.updateTask)
  const deleteTask = useProjectTasksStore((s) => s.deleteTask)
  const addSubtask = useProjectTasksStore((s) => s.addSubtask)
  const toggleSubtask = useProjectTasksStore((s) => s.toggleSubtask)
  const deleteSubtask = useProjectTasksStore((s) => s.deleteSubtask)

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? '')
  const [urgent, setUrgent] = useState(task?.urgent ?? false)
  const [important, setImportant] = useState(task?.important ?? false)
  const [newSubtask, setNewSubtask] = useState('')
  const [localSubtasks, setLocalSubtasks] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    if (task) {
      await updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority,
        urgent,
        important,
        assignedTo: assignedTo || undefined,
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
        boardId: board.id,
        columnId: defaultColumnId ?? board.columns[0]?.id,
        assignedTo: assignedTo || undefined,
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
          placeholder="Was ist zu tun?"
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
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
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
          <label className="mb-1 block text-xs font-medium text-gray-500">Zugewiesen an</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          >
            <option value="">Niemand</option>
            {board.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.profile.display_name} (@{m.profile.username})
              </option>
            ))}
          </select>
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

        {error && <p className="text-sm text-red-500">{error}</p>}

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
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {task ? 'Speichern' : 'Hinzufügen'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
