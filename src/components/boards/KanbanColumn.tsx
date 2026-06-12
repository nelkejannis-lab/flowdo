import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import type { BoardColumn, Task } from '../../types'
import KanbanCard from './KanbanCard'

interface KanbanColumnProps {
  column: BoardColumn
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onAddTask: () => void
  onRenameColumn: (title: string) => void
  onDeleteColumn: () => void
}

export default function KanbanColumn({
  column,
  tasks,
  onTaskClick,
  onAddTask,
  onRenameColumn,
  onDeleteColumn,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(column.title)

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 flex-shrink-0 flex-col rounded-xl bg-gray-50 p-3 transition-colors dark:bg-racing-900/50 ${
        isOver ? 'ring-2 ring-accent' : ''
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        {renaming ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setRenaming(false)
              if (title.trim()) onRenameColumn(title.trim())
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            className="rounded border border-gray-200 bg-transparent px-1 text-sm font-semibold focus:outline-none dark:border-racing-700"
          />
        ) : (
          <h3 className="text-sm font-semibold">
            {column.title} <span className="text-gray-400">({tasks.length})</span>
          </h3>
        )}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-racing-800"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border border-gray-100 bg-white py-1 text-sm shadow-lg dark:border-racing-800 dark:bg-racing-900">
              <button
                onClick={() => {
                  setRenaming(true)
                  setMenuOpen(false)
                }}
                className="block w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-racing-800"
              >
                Umbenennen
              </button>
              <button
                onClick={onDeleteColumn}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-red-500 hover:bg-gray-50 dark:hover:bg-racing-800"
              >
                <Trash2 size={14} />
                Löschen
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {tasks.map((task) => (
          <KanbanCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
        ))}
      </div>

      <button
        onClick={onAddTask}
        className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
      >
        <Plus size={14} />
        Aufgabe hinzufügen
      </button>
    </div>
  )
}
