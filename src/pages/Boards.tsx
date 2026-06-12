import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useBoardsStore } from '../store/boardsStore'
import BoardCard from '../components/boards/BoardCard'
import BoardFormModal from '../components/boards/BoardFormModal'

export default function BoardsPage() {
  const boards = useBoardsStore((s) => s.boards)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projekte</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          <Plus size={16} />
          Projekt
        </button>
      </div>

      {boards.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          Noch keine Projekte. Erstelle dein erstes Projekt und lade Kollegen dazu ein.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))}
        </div>
      )}

      {showForm && <BoardFormModal onClose={() => setShowForm(false)} />}
    </div>
  )
}
