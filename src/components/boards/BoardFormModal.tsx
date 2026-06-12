import { useState } from 'react'
import Modal from '../layout/Modal'
import { useBoardsStore, BOARD_COLORS } from '../../store/boardsStore'
import type { Board } from '../../types'

interface BoardFormModalProps {
  board?: Board
  onClose: () => void
}

export default function BoardFormModal({ board, onClose }: BoardFormModalProps) {
  const addBoard = useBoardsStore((s) => s.addBoard)
  const updateBoard = useBoardsStore((s) => s.updateBoard)
  const deleteBoard = useBoardsStore((s) => s.deleteBoard)

  const [title, setTitle] = useState(board?.title ?? '')
  const [description, setDescription] = useState(board?.description ?? '')
  const [deadline, setDeadline] = useState(board?.deadline ?? '')
  const [color, setColor] = useState(board?.color ?? BOARD_COLORS[0])
  const [internalLaunch, setInternalLaunch] = useState(board?.internalLaunch ?? '')
  const [externalLaunch, setExternalLaunch] = useState(board?.externalLaunch ?? '')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    if (board) {
      await updateBoard(board.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadline || undefined,
        color,
        internalLaunch: internalLaunch || undefined,
        externalLaunch: externalLaunch || undefined,
      })
    } else {
      await addBoard({
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadline || undefined,
        color,
        internalLaunch: internalLaunch || undefined,
        externalLaunch: externalLaunch || undefined,
      })
    }
    onClose()
  }

  return (
    <Modal title={board ? 'Projekt bearbeiten' : 'Neues Projekt'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name des Projekts"
          className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-medium focus:border-accent focus:outline-none dark:border-racing-700"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschreibung (optional)"
          rows={2}
          className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Deadline</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Farbe</label>
          <div className="flex flex-wrap gap-2">
            {BOARD_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Interner Launch</label>
            <input
              type="date"
              value={internalLaunch}
              onChange={(e) => setInternalLaunch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Externer Launch</label>
            <input
              type="date"
              value={externalLaunch}
              onChange={(e) => setExternalLaunch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="mt-2 flex items-center justify-between">
          {board ? (
            <button
              type="button"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true)
                setError(null)
                const err = await deleteBoard(board.id)
                setDeleting(false)
                if (err) {
                  setError(err)
                  return
                }
                onClose()
              }}
              className="text-sm font-medium text-red-500 hover:underline disabled:opacity-60"
            >
              Löschen
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
          >
            {board ? 'Speichern' : 'Erstellen'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
