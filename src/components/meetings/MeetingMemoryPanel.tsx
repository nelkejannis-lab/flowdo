import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Plus, Trash2, Brain, Link2 } from 'lucide-react'
import { useMemoryStore, type MemorySource } from '../../store/memoryStore'
import { isSupabaseConfigured } from '../../lib/supabase'

interface Props {
  meetingId?: string
  defaultSource?: MemorySource
  compact?: boolean
}

export default function MeetingMemoryPanel({ meetingId, defaultSource = 'whatsapp', compact }: Props) {
  const { t } = useTranslation('memory')
  const items = useMemoryStore((s) => s.items ?? [])
  const fetchAll = useMemoryStore((s) => s.fetchAll)
  const addMemory = useMemoryStore((s) => s.addMemory)
  const deleteMemory = useMemoryStore((s) => s.deleteMemory)
  const [input, setInput] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (isSupabaseConfigured) void fetchAll()
  }, [fetchAll])

  const filtered = meetingId ? items.filter((i) => i.meetingId === meetingId) : items

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    addMemory({
      text: input.trim(),
      source: defaultSource,
      meetingId,
      tags: meetingId ? ['meeting'] : [],
    })
    setInput('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-gray-100/80 bg-white p-4 dark:border-racing-800 dark:bg-racing-900 ${compact ? '' : 'shadow-sm'}`}>
      <div className="flex items-center gap-2">
        <MessageCircle size={16} className="text-emerald-500" />
        <h3 className="text-sm font-semibold">{t('panelTitle')}</h3>
        <span className="ml-auto text-[10px] text-gray-400">{t('sourceHint')}</span>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder')}
          className="flex-1 rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
        />
        <button
          type="submit"
          className="flex items-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-dark"
        >
          <Plus size={14} /> {saved ? t('saved') : t('add')}
        </button>
      </form>

      {filtered.length === 0 ? (
        <p className="text-xs text-gray-400 italic">{t('empty')}</p>
      ) : (
        <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
          {filtered.map((item) => (
            <li key={item.id} className="flex items-start gap-2 rounded-xl bg-gray-50 p-2.5 text-sm dark:bg-racing-800">
              <span className="flex-1 whitespace-pre-wrap">{item.text}</span>
              <div className="flex shrink-0 gap-1">
                {item.linkedBrainPageId && (
                  <span title={t('linkedBrain')} className="text-accent"><Brain size={14} /></span>
                )}
                <button
                  onClick={() => deleteMemory(item.id)}
                  className="text-gray-400 hover:text-red-500"
                  aria-label={t('delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!compact && (
        <p className="flex items-center gap-1 text-[10px] text-gray-400">
          <Link2 size={10} /> {t('whatsappNote')}
        </p>
      )}
    </div>
  )
}
