import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { deleteAttachment, uploadAttachment } from '../lib/attachments'
import type { Attachment, Board, BoardColumn, BoardFolder, ProjectMember } from '../types'

interface NewBoardInput {
  title: string
  description?: string
  color: string
  deadline?: string
  internalLaunch?: string
  externalLaunch?: string
  folderId?: string | null
  responsibleUserId?: string | null
}

interface BoardFolderRow {
  id: string
  owner_id: string
  title: string
  position: number
  created_at: string
}

function toFolder(row: BoardFolderRow): BoardFolder {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    position: row.position,
    createdAt: row.created_at,
  }
}

const defaultColumnTitles = ['To Do', 'In Arbeit', 'Erledigt']

interface BoardRow {
  id: string
  owner_id: string
  title: string
  description: string | null
  color: string
  deadline: string | null
  internal_launch: string | null
  external_launch: string | null
  created_at: string
  board_columns: { id: string; title: string; position: number }[] | null
  board_members: { user_id: string; role: 'owner' | 'member'; profile: ProjectMember['profile'] | ProjectMember['profile'][] }[] | null
  attachments: Attachment[] | null
  folder_id: string | null
  responsible_user_id: string | null
}

interface TaskStats {
  total: number
  done: number
}

function single<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value
}

function toBoard(row: BoardRow): Board {
  const columns: BoardColumn[] = (row.board_columns ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, title: c.title }))

  const members: ProjectMember[] = (row.board_members ?? [])
    .map((m) => ({ userId: m.user_id, role: m.role, profile: single(m.profile) }))
    .filter((m) => m.profile)

  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description ?? undefined,
    color: row.color,
    deadline: row.deadline ?? undefined,
    internalLaunch: row.internal_launch ?? undefined,
    externalLaunch: row.external_launch ?? undefined,
    folderId: row.folder_id ?? undefined,
    responsibleUserId: row.responsible_user_id ?? undefined,
    columns,
    members,
    attachments: row.attachments ?? [],
    createdAt: row.created_at,
  }
}

interface BoardsState {
  boards: Board[]
  folders: BoardFolder[]
  taskStats: Record<string, TaskStats>
  loading: boolean
  error: string | null
  fetchBoards: () => Promise<void>
  fetchFolders: () => Promise<void>
  addBoard: (input: NewBoardInput) => Promise<Board | null>
  updateBoard: (id: string, updates: Partial<NewBoardInput>) => Promise<void>
  deleteBoard: (id: string) => Promise<string | null>
  addColumn: (boardId: string, title: string) => Promise<void>
  updateColumn: (boardId: string, columnId: string, title: string) => Promise<void>
  deleteColumn: (boardId: string, columnId: string) => Promise<void>
  removeMember: (boardId: string, userId: string) => Promise<void>
  addAttachment: (boardId: string, file: File) => Promise<{ attachment?: Attachment; error?: string }>
  removeAttachment: (boardId: string, attachmentId: string) => Promise<void>
  addFolder: (title: string) => Promise<void>
  renameFolder: (id: string, title: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  moveBoardToFolder: (boardId: string, folderId: string | null) => Promise<void>
}

export const useBoardsStore = create<BoardsState>()((set, get) => ({
  boards: [],
  folders: [],
  taskStats: {},
  loading: false,
  error: null,

  fetchBoards: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('boards')
      .select(
        '*, board_columns(id, title, position), board_members(user_id, role, profile:profiles!board_members_user_id_fkey(id, username, display_name, avatar_color))'
      )
      .order('created_at', { ascending: false })

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    const boards = ((data ?? []) as unknown as BoardRow[]).map(toBoard)

    const boardIds = boards.map((b) => b.id)
    const taskStats: Record<string, TaskStats> = {}
    if (boardIds.length > 0) {
      const { data: taskRows } = await supabase
        .from('tasks')
        .select('board_id, completed')
        .in('board_id', boardIds)

      for (const row of taskRows ?? []) {
        const boardId = (row as { board_id: string; completed: boolean }).board_id
        const completed = (row as { board_id: string; completed: boolean }).completed
        if (!taskStats[boardId]) taskStats[boardId] = { total: 0, done: 0 }
        taskStats[boardId].total += 1
        if (completed) taskStats[boardId].done += 1
      }
    }

    set({ boards, taskStats, loading: false })
  },

  fetchFolders: async () => {
    const { data, error } = await supabase
      .from('board_folders')
      .select('*')
      .order('position', { ascending: true })

    if (error) return
    set({ folders: ((data ?? []) as unknown as BoardFolderRow[]).map(toFolder) })
  },

  addBoard: async (input) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return null

    const { data, error } = await supabase
      .from('boards')
      .insert({
        owner_id: userId,
        title: input.title,
        description: input.description ?? null,
        color: input.color,
        deadline: input.deadline ?? null,
        internal_launch: input.internalLaunch ?? null,
        external_launch: input.externalLaunch ?? null,
        folder_id: input.folderId ?? null,
        responsible_user_id: input.responsibleUserId ?? null,
      })
      .select('id')
      .single()

    if (error || !data) return null

    await supabase
      .from('board_columns')
      .insert(defaultColumnTitles.map((title, position) => ({ board_id: data.id, title, position })))

    await get().fetchBoards()
    return get().boards.find((b) => b.id === data.id) ?? null
  },

  updateBoard: async (id, updates) => {
    await supabase
      .from('boards')
      .update({
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.description !== undefined ? { description: updates.description ?? null } : {}),
        ...(updates.color !== undefined ? { color: updates.color } : {}),
        ...(updates.deadline !== undefined ? { deadline: updates.deadline ?? null } : {}),
        ...(updates.internalLaunch !== undefined ? { internal_launch: updates.internalLaunch ?? null } : {}),
        ...(updates.externalLaunch !== undefined ? { external_launch: updates.externalLaunch ?? null } : {}),
        ...(updates.folderId !== undefined ? { folder_id: updates.folderId || null } : {}),
        ...(updates.responsibleUserId !== undefined ? { responsible_user_id: updates.responsibleUserId || null } : {}),
      })
      .eq('id', id)

    await get().fetchBoards()
  },

  deleteBoard: async (id) => {
    const { error } = await supabase.from('boards').delete().eq('id', id)
    if (error) return error.message
    set((state) => ({ boards: state.boards.filter((b) => b.id !== id) }))
    return null
  },

  addColumn: async (boardId, title) => {
    const board = get().boards.find((b) => b.id === boardId)
    const position = board ? board.columns.length : 0
    await supabase.from('board_columns').insert({ board_id: boardId, title, position })
    await get().fetchBoards()
  },

  updateColumn: async (boardId, columnId, title) => {
    await supabase.from('board_columns').update({ title }).eq('id', columnId)
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId ? { ...b, columns: b.columns.map((c) => (c.id === columnId ? { ...c, title } : c)) } : b
      ),
    }))
  },

  deleteColumn: async (boardId, columnId) => {
    await supabase.from('board_columns').delete().eq('id', columnId)
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId ? { ...b, columns: b.columns.filter((c) => c.id !== columnId) } : b
      ),
    }))
  },

  removeMember: async (boardId, userId) => {
    await supabase.from('board_members').delete().eq('board_id', boardId).eq('user_id', userId)
    await get().fetchBoards()
  },

  addAttachment: async (boardId, file) => {
    const board = get().boards.find((b) => b.id === boardId)
    if (!board) return { error: 'Projekt nicht gefunden' }
    const { attachment, error } = await uploadAttachment(`boards/${boardId}`, file)
    if (error || !attachment) return { error: error ?? 'Fehler beim Hochladen' }
    const attachments = [...board.attachments, attachment]
    await supabase.from('boards').update({ attachments }).eq('id', boardId)
    set((state) => ({ boards: state.boards.map((b) => (b.id === boardId ? { ...b, attachments } : b)) }))
    return { attachment }
  },

  removeAttachment: async (boardId, attachmentId) => {
    const board = get().boards.find((b) => b.id === boardId)
    if (!board) return
    const attachment = board.attachments.find((a) => a.id === attachmentId)
    if (attachment) await deleteAttachment(attachment.path)
    const attachments = board.attachments.filter((a) => a.id !== attachmentId)
    await supabase.from('boards').update({ attachments }).eq('id', boardId)
    set((state) => ({ boards: state.boards.map((b) => (b.id === boardId ? { ...b, attachments } : b)) }))
  },

  addFolder: async (title) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return
    const position = get().folders.length
    const { data, error } = await supabase
      .from('board_folders')
      .insert({ owner_id: userId, title, position })
      .select('*')
      .single()
    if (error || !data) return
    set((state) => ({ folders: [...state.folders, toFolder(data as unknown as BoardFolderRow)] }))
  },

  renameFolder: async (id, title) => {
    await supabase.from('board_folders').update({ title }).eq('id', id)
    set((state) => ({ folders: state.folders.map((f) => (f.id === id ? { ...f, title } : f)) }))
  },

  deleteFolder: async (id) => {
    await supabase.from('boards').update({ folder_id: null }).eq('folder_id', id)
    await supabase.from('board_folders').delete().eq('id', id)
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      boards: state.boards.map((b) => (b.folderId === id ? { ...b, folderId: undefined } : b)),
    }))
  },

  moveBoardToFolder: async (boardId, folderId) => {
    await supabase.from('boards').update({ folder_id: folderId }).eq('id', boardId)
    set((state) => ({
      boards: state.boards.map((b) => (b.id === boardId ? { ...b, folderId: folderId ?? undefined } : b)),
    }))
  },
}))

export const BOARD_COLORS = [
  '#4772FA', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
]
