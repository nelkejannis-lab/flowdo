import { useEffect, useRef, useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { useCommentsStore } from '../../store/commentsStore'
import { useFriendsStore } from '../../store/friendsStore'
import { useAuthStore } from '../../store/authStore'
import { isSupabaseConfigured } from '../../lib/supabase'

interface Props {
  taskId?: string
  boardId?: string
}

export default function CommentSection({ taskId, boardId }: Props) {
  const contextId = taskId ?? boardId!
  const comments = useCommentsStore((s) => s.comments[contextId] ?? [])
  const fetch = useCommentsStore((s) => s.fetch)
  const add = useCommentsStore((s) => s.add)
  const remove = useCommentsStore((s) => s.remove)
  const friends = useFriendsStore((s) => s.friends)
  const currentUserId = useAuthStore((s) => s.user?.id)

  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isSupabaseConfigured) fetch(contextId)
  }, [contextId, fetch])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  const mentionSuggestions = mentionQuery !== null
    ? friends.filter((f) =>
        f.profile.display_name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        f.profile.username.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 5)
    : []

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setBody(val)
    const cursor = e.target.selectionStart ?? val.length
    const match = val.slice(0, cursor).match(/@(\w*)$/)
    if (match) {
      setMentionQuery(match[1])
      setMentionStart(cursor - match[0].length)
    } else {
      setMentionQuery(null)
    }
  }

  function insertMention(displayName: string) {
    const cursor = textareaRef.current?.selectionStart ?? body.length
    const before = body.slice(0, mentionStart)
    const after = body.slice(cursor)
    const newBody = `${before}@${displayName} ${after}`
    setBody(newBody)
    setMentionQuery(null)
    setTimeout(() => {
      const pos = mentionStart + displayName.length + 2
      textareaRef.current?.setSelectionRange(pos, pos)
      textareaRef.current?.focus()
    }, 0)
  }

  function extractMentionedIds(text: string): string[] {
    const ids: string[] = []
    for (const f of friends) {
      if (text.includes(`@${f.profile.display_name}`)) {
        ids.push(f.profile.id)
      }
    }
    return ids
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    await add({
      body: body.trim(),
      taskId,
      boardId,
      mentionedUserIds: extractMentionedIds(body),
    })
    setBody('')
    setSubmitting(false)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function renderBody(text: string) {
    const parts = text.split(/(@\w[\w\s]*?)(?=\s|@|$)/g)
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="font-semibold text-accent">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 && (
        <p className="text-xs text-gray-400">Noch keine Kommentare.</p>
      )}
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2">
            <span
              className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: c.authorColor }}
            >
              {c.authorName.slice(0, 2).toUpperCase()}
            </span>
            <div className="flex-1 rounded-lg bg-gray-50 px-3 py-2 dark:bg-racing-800">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="text-xs font-semibold">{c.authorName}</span>
                <span className="text-[10px] text-gray-400">{formatTime(c.createdAt)}</span>
                {c.authorId === currentUserId && (
                  <button
                    onClick={() => remove(c.id, contextId)}
                    className="ml-auto text-gray-300 hover:text-red-400"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
              <p className="text-xs leading-relaxed text-gray-700 dark:text-racing-100">
                {renderBody(c.body)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleBodyChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent) }
            if (e.key === 'Escape') setMentionQuery(null)
          }}
          placeholder="Kommentar schreiben… @ zum Erwähnen"
          rows={2}
          className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 pr-10 text-xs focus:border-accent focus:outline-none dark:border-racing-700"
        />
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="absolute bottom-2 right-2 rounded-md p-1 text-accent hover:bg-accent/10 disabled:opacity-40"
        >
          <Send size={14} />
        </button>

        {mentionQuery !== null && mentionSuggestions.length > 0 && (
          <div className="absolute bottom-full left-0 z-20 mb-1 w-52 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-racing-700 dark:bg-racing-900">
            {mentionSuggestions.map((f) => (
              <button
                key={f.profile.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(f.profile.display_name) }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-racing-800"
              >
                <span
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                  style={{ backgroundColor: f.profile.avatar_color }}
                >
                  {f.profile.display_name.slice(0, 2).toUpperCase()}
                </span>
                <span className="font-medium">{f.profile.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  )
}
