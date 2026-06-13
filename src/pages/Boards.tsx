import { useEffect, useState } from 'react'
import { Check, ChevronDown, FolderPlus, Pencil, Plus, Trash2, X, Folder } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useBoardsStore } from '../store/boardsStore'
import { useBoardInvitesStore } from '../store/boardInvitesStore'
import { isSupabaseConfigured } from '../lib/supabase'
import type { Board, BoardFolder } from '../types'
import BoardCard from '../components/boards/BoardCard'
import BoardFormModal from '../components/boards/BoardFormModal'

// Draggable wrapper around BoardCard
function DraggableBoardCard({ board }: { board: Board }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: board.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      className="touch-none"
    >
      <BoardCard board={board} />
    </div>
  )
}

// Droppable folder section
function FolderSection({ folder, boards }: { folder: BoardFolder; boards: Board[] }) {
  const renameFolder = useBoardsStore((s) => s.renameFolder)
  const deleteFolder = useBoardsStore((s) => s.deleteFolder)
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(folder.title)

  const { setNodeRef, isOver } = useDroppable({ id: `folder-${folder.id}` })

  function saveTitle() {
    const trimmed = title.trim()
    if (trimmed && trimmed !== folder.title) renameFolder(folder.id, trimmed)
    else setTitle(folder.title)
    setEditing(false)
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
        >
          <ChevronDown size={16} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </button>
        {editing ? (
          <>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle()
                if (e.key === 'Escape') { setTitle(folder.title); setEditing(false) }
              }}
              className="rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-sm font-semibold focus:border-accent focus:outline-none dark:border-racing-700"
            />
            <button onClick={saveTitle} className="rounded-md p-1 text-gray-400 hover:text-emerald-500">
              <Check size={16} />
            </button>
            <button onClick={() => { setTitle(folder.title); setEditing(false) }} className="rounded-md p-1 text-gray-400 hover:text-red-500">
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <Folder size={16} className="text-gray-400" />
            <h2 className="text-lg font-semibold">{folder.title}</h2>
            <span className="text-sm text-gray-400">({boards.length})</span>
            <button onClick={() => setEditing(true)} className="rounded-md p-1 text-gray-400 hover:text-accent">
              <Pencil size={14} />
            </button>
            <button
              onClick={() => { if (confirm(`Ordner „${folder.title}" löschen? Projekte bleiben erhalten.`)) deleteFolder(folder.id) }}
              className="rounded-md p-1 text-gray-400 hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`mb-6 min-h-[80px] rounded-xl transition-colors ${
          isOver ? 'bg-accent/5 ring-2 ring-accent/30' : ''
        }`}
      >
        {!collapsed && (
          boards.length === 0 ? (
            <p className={`py-6 text-center text-sm ${isOver ? 'text-accent' : 'text-gray-400'}`}>
              {isOver ? 'Hier ablegen' : 'Projekt hierher ziehen oder noch keine Projekte.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map((board) => (
                <DraggableBoardCard key={board.id} board={board} />
              ))}
            </div>
          )
        )}
        {!collapsed && boards.length > 0 && isOver && (
          <p className="mt-2 text-center text-xs text-accent">Hier ablegen</p>
        )}
      </div>
    </div>
  )
}

// Droppable "Ohne Ordner" section
function UnfiledSection({ boards }: { boards: Board[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'folder-null' })
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">Ohne Ordner</h2>
      <div
        ref={setNodeRef}
        className={`mb-6 min-h-[80px] rounded-xl transition-colors ${
          isOver ? 'bg-accent/5 ring-2 ring-accent/30' : ''
        }`}
      >
        {boards.length === 0 ? (
          <p className={`py-6 text-center text-sm ${isOver ? 'text-accent' : 'text-gray-400'}`}>
            {isOver ? 'Hier ablegen um aus Ordner zu entfernen' : 'Keine Projekte ohne Ordner.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <DraggableBoardCard key={board.id} board={board} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BoardsPage() {
  const boards = useBoardsStore((s) => s.boards)
  const folders = useBoardsStore((s) => s.folders)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const fetchFolders = useBoardsStore((s) => s.fetchFolders)
  const addFolder = useBoardsStore((s) => s.addFolder)
  const moveBoardToFolder = useBoardsStore((s) => s.moveBoardToFolder)
  const incoming = useBoardInvitesStore((s) => s.incoming)
  const fetchIncoming = useBoardInvitesStore((s) => s.fetchIncoming)
  const acceptInvite = useBoardInvitesStore((s) => s.acceptInvite)
  const declineInvite = useBoardInvitesStore((s) => s.declineInvite)
  const [showForm, setShowForm] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderTitle, setNewFolderTitle] = useState('')
  const [draggingBoard, setDraggingBoard] = useState<Board | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    fetchBoards()
    if (isSupabaseConfigured) {
      fetchFolders()
      fetchIncoming()
    }
  }, [fetchBoards, fetchFolders, fetchIncoming])

  async function handleAddFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!newFolderTitle.trim()) return
    await addFolder(newFolderTitle.trim())
    setNewFolderTitle('')
    setShowNewFolder(false)
  }

  function onDragStart(event: DragStartEvent) {
    const board = boards.find((b) => b.id === event.active.id)
    setDraggingBoard(board ?? null)
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingBoard(null)
    const { active, over } = event
    if (!over) return
    const boardId = active.id as string
    const overId = over.id as string
    if (overId === 'folder-null') {
      moveBoardToFolder(boardId, null)
    } else if (overId.startsWith('folder-')) {
      const folderId = overId.replace('folder-', '')
      moveBoardToFolder(boardId, folderId)
    }
  }

  const unfiledBoards = boards.filter((b) => !b.folderId)

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Projekte</h1>
          <div className="flex items-center gap-2">
            {isSupabaseConfigured && (
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-racing-700 dark:text-racing-100 dark:hover:bg-racing-800"
              >
                <FolderPlus size={16} />
                Ordner
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
            >
              <Plus size={16} />
              Projekt
            </button>
          </div>
        </div>

        {showNewFolder && (
          <form onSubmit={handleAddFolder} className="mb-6 flex items-center gap-2">
            <input
              autoFocus
              value={newFolderTitle}
              onChange={(e) => setNewFolderTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowNewFolder(false) }}
              placeholder="Ordnername"
              className="flex-1 rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700 sm:flex-none sm:w-64"
            />
            <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
              Erstellen
            </button>
            <button type="button" onClick={() => setShowNewFolder(false)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800">
              Abbrechen
            </button>
          </form>
        )}

        {incoming.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold">Projekteinladungen</h2>
            <div className="flex flex-col gap-2">
              {incoming.map((invite) => (
                <div key={invite.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: invite.boardColor }}>
                    {invite.boardTitle.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{invite.boardTitle}</p>
                    <p className="truncate text-xs text-gray-400">von {invite.fromUser.display_name}</p>
                  </div>
                  <button onClick={() => acceptInvite(invite.id)} className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark">
                    <Check size={14} /> Annehmen
                  </button>
                  <button onClick={() => declineInvite(invite.id)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800">
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
          <>
            {folders.map((folder) => (
              <FolderSection key={folder.id} folder={folder} boards={boards.filter((b) => b.folderId === folder.id)} />
            ))}
            {folders.length > 0 ? (
              <UnfiledSection boards={unfiledBoards} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {boards.map((board) => (
                  <DraggableBoardCard key={board.id} board={board} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <DragOverlay>
        {draggingBoard && (
          <div className="rotate-2 opacity-90 shadow-xl">
            <BoardCard board={draggingBoard} />
          </div>
        )}
      </DragOverlay>

      {showForm && <BoardFormModal onClose={() => setShowForm(false)} />}
    </DndContext>
  )
}
