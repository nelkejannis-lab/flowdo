import { useEffect, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { useBoardsStore } from '../store/boardsStore'
import { useBoardInvitesStore } from '../store/boardInvitesStore'
import { isSupabaseConfigured } from '../lib/supabase'
import BoardCard from '../components/boards/BoardCard'
import BoardFormModal from '../components/boards/BoardFormModal'

export default function BoardsPage() {
  const boards = useBoardsStore((s) => s.boards)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const incoming = useBoardInvitesStore((s) => s.incoming)
  const fetchIncoming = useBoardInvitesStore((s) => s.fetchIncoming)
  const acceptInvite = useBoardInvitesStore((s) => s.acceptInvite)
  const declineInvite = useBoardInvitesStore((s) => s.declineInvite)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchBoards()
    if (isSupabaseConfigured) fetchIncoming()
  }, [fetchBoards, fetchIncoming])

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

      {incoming.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Projekteinladungen</h2>
          <div className="flex flex-col gap-2">
            {incoming.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900"
              >
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: invite.boardColor }}
                >
                  {invite.boardTitle.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invite.boardTitle}</p>
                  <p className="truncate text-xs text-gray-400">von {invite.fromUser.display_name}</p>
                </div>
                <button
                  onClick={() => acceptInvite(invite.id)}
                  className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                >
                  <Check size={14} /> Annehmen
                </button>
                <button
                  onClick={() => declineInvite(invite.id)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
                >
                  <X size={14} /> Ablehnen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
