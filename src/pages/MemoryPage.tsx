import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Trash2, Filter } from 'lucide-react'
import { useMemoryStore, type MemorySource } from '../store/memoryStore'
import { isSupabaseConfigured } from '../lib/supabase'
import MeetingMemoryPanel from '../components/meetings/MeetingMemoryPanel'

const SOURCES: (MemorySource | 'all')[] = ['all', 'whatsapp', 'manual', 'meeting', 'brain']

export default function MemoryPage() {
  const { t } = useTranslation('memory')
  const items = useMemoryStore((s) => s.items ?? [])
  const fetchAll = useMemoryStore((s) => s.fetchAll)
  const deleteMemory = useMemoryStore((s) => s.deleteMemory)
  const [filter, setFilter] = useState<MemorySource | 'all'>('all')

  useEffect(() => {
    if (isSupabaseConfigured) void fetchAll()
  }, [fetchAll])

  const filtered = filter === 'all' ? items : items.filter((i) => i.source === filter)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <MessageCircle size={24} className="text-emerald-500" />
          {t('pageTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-400">{t('pageIntro')}</p>
      </div>

      <MeetingMemoryPanel defaultSource="whatsapp" />

      <div className="flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-gray-400" />
        {SOURCES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === s ? 'bg-accent text-white' : 'bg-gray-100 text-gray-500 dark:bg-racing-800'
            }`}
          >
            {t(`sources.${s}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">{t('empty')}</p>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="card-apple flex items-start gap-3 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="whitespace-pre-wrap text-sm">{item.text}</p>
                <p className="mt-1 text-[10px] text-gray-400">
                  {t(`sources.${item.source}`)} · {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => deleteMemory(item.id)}
                className="shrink-0 text-gray-400 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
