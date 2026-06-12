import { useState } from 'react'
import { useBoardsStore } from '../../store/boardsStore'
import BoardTasksModal from './BoardTasksModal'

interface BoardBadgeProps {
  boardId: string
}

export default function BoardBadge({ boardId }: BoardBadgeProps) {
  const board = useBoardsStore((s) => s.boards.find((b) => b.id === boardId))
  const [open, setOpen] = useState(false)

  if (!board) return null

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className="flex items-center gap-1.5 rounded-full border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 dark:border-racing-700 dark:text-racing-100 dark:hover:border-racing-600"
        title={`Alle Aufgaben in "${board.title}" anzeigen`}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: board.color }} />
        <span className="max-w-[120px] truncate">{board.title}</span>
      </button>
      {open && <BoardTasksModal boardId={boardId} onClose={() => setOpen(false)} />}
    </>
  )
}
