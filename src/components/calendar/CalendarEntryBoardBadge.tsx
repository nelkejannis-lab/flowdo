import type { CalendarEntryBoard } from '../../types'

interface Props {
  board?: CalendarEntryBoard
  className?: string
}

export default function CalendarEntryBoardBadge({ board, className = '' }: Props) {
  if (!board) return null
  return (
    <span
      className={`inline-flex max-w-[8rem] items-center truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${className}`}
      style={{ backgroundColor: board.color }}
      title={board.title}
    >
      {board.title}
    </span>
  )
}
