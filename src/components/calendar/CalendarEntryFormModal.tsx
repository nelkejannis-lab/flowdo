import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, CalendarHeart, Plane, Sparkles } from 'lucide-react'
import Modal from '../layout/Modal'
import { useEventsStore, EVENT_COLORS } from '../../store/eventsStore'
import { useCalendarEntriesStore } from '../../store/calendarEntriesStore'
import { useFriendsStore } from '../../store/friendsStore'
import { isSupabaseConfigured } from '../../lib/supabase'
import type { CalendarEntry, CalendarEntryType, CalendarEvent } from '../../types'
import { todayISO } from '../../utils/date'

type Kind = 'event' | CalendarEntryType

interface CalendarEntryFormModalProps {
  event?: CalendarEvent
  entry?: CalendarEntry
  defaultDate?: string
  onClose: () => void
}

const typeIcons: Record<Kind, typeof CalendarClock> = {
  event: Sparkles,
  termin: CalendarClock,
  reise: Plane,
  urlaub: CalendarHeart,
}

const defaultColors: Record<CalendarEntryType, string> = {
  termin: '#10B981',
  reise: '#06B6D4',
  urlaub: '#F59E0B',
}

export default function CalendarEntryFormModal({ event, entry, defaultDate, onClose }: CalendarEntryFormModalProps) {
  const { t } = useTranslation('calendar')
  const typeOptions: { kind: Kind; label: string; icon: typeof CalendarClock }[] = [
    { kind: 'event', label: t('form.types.event'), icon: typeIcons.event },
    { kind: 'termin', label: t('form.types.termin'), icon: typeIcons.termin },
    { kind: 'reise', label: t('form.types.reise'), icon: typeIcons.reise },
    { kind: 'urlaub', label: t('form.types.urlaub'), icon: typeIcons.urlaub },
  ]
  const addEvent = useEventsStore((s) => s.addEvent)
  const updateEvent = useEventsStore((s) => s.updateEvent)
  const deleteEvent = useEventsStore((s) => s.deleteEvent)
  const addEntry = useCalendarEntriesStore((s) => s.addEntry)
  const updateEntry = useCalendarEntriesStore((s) => s.updateEntry)
  const deleteEntry = useCalendarEntriesStore((s) => s.deleteEntry)
  const friends = useFriendsStore((s) => s.friends)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)

  const editing = event ?? entry
  const initialKind: Kind = event ? 'event' : entry ? entry.type : 'event'

  const [kind, setKind] = useState<Kind>(initialKind)
  const [title, setTitle] = useState(editing?.title ?? '')
  const [date, setDate] = useState(editing?.date ?? defaultDate ?? todayISO())
  const [endDate, setEndDate] = useState(editing?.endDate ?? '')
  const [startTime, setStartTime] = useState(entry?.startTime ?? '')
  const [endTime, setEndTime] = useState(entry?.endTime ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [color, setColor] = useState(editing?.color ?? EVENT_COLORS[0])
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>(entry?.invitees.map((i) => i.id) ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isSupabaseConfigured && !editing) fetchFriends()
  }, [fetchFriends, editing])

  useEffect(() => {
    if (!editing && kind !== 'event') {
      setColor(defaultColors[kind])
    } else if (!editing && kind === 'event') {
      setColor(EVENT_COLORS[0])
    }
  }, [kind, editing])

  function toggleInvitee(userId: string) {
    setInvitedUserIds((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return

    const normalizedEndDate = endDate && endDate > date ? endDate : undefined

    if (kind === 'event') {
      if (event) {
        updateEvent(event.id, {
          title: title.trim(),
          date,
          endDate: normalizedEndDate,
          description: description.trim() || undefined,
          color,
        })
      } else {
        addEvent({
          title: title.trim(),
          date,
          endDate: normalizedEndDate,
          description: description.trim() || undefined,
          color,
        })
      }
      onClose()
      return
    }

    setSaving(true)
    setError(null)
    const input = {
      type: kind,
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      endDate: normalizedEndDate,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      color,
      invitedUserIds,
    }
    const err = entry ? await updateEntry(entry.id, input) : await addEntry(input)
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    onClose()
  }

  function handleDelete() {
    if (event) {
      deleteEvent(event.id)
      onClose()
    } else if (entry) {
      deleteEntry(entry.id)
      onClose()
    }
  }

  return (
    <Modal title={editing ? t('form.titleEdit') : t('form.titleAdd')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {!editing && (
          <div className="grid grid-cols-4 gap-2">
            {typeOptions.map((opt) => {
              const Icon = opt.icon
              const active = kind === opt.kind
              return (
                <button
                  type="button"
                  key={opt.kind}
                  onClick={() => setKind(opt.kind)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    active
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-racing-700 dark:text-racing-200'
                  }`}
                >
                  <Icon size={16} />
                  {opt.label}
                </button>
              )
            })}
          </div>
        )}

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            kind === 'event'
              ? t('form.titlePlaceholder.event')
              : kind === 'termin'
              ? t('form.titlePlaceholder.termin')
              : kind === 'reise'
              ? t('form.titlePlaceholder.reise')
              : t('form.titlePlaceholder.urlaub')
          }
          className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-medium focus:border-accent focus:outline-none dark:border-racing-700"
        />

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.date')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                if (endDate && endDate < e.target.value) setEndDate('')
              }}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.endDateOptional')}</label>
            <input
              type="date"
              value={endDate}
              min={date}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
          </div>
        </div>

        {(kind === 'termin' || kind === 'reise') && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.startTimeOptional')}</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.endTimeOptional')}</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
            </div>
          </div>
        )}

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('form.descriptionPlaceholder')}
          rows={2}
          className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
        />

        {kind !== 'event' && isSupabaseConfigured && friends.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.inviteColleagues')}</label>
            <div className="flex flex-wrap gap-2">
              {friends.map((f) => {
                const active = invitedUserIds.includes(f.profile.id)
                return (
                  <button
                    type="button"
                    key={f.profile.id}
                    onClick={() => toggleInvitee(f.profile.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-racing-700 dark:text-racing-200'
                    }`}
                  >
                    {f.profile.display_name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.color')}</label>
          <div className="flex flex-wrap gap-2">
            {EVENT_COLORS.map((c) => (
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

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="mt-2 flex items-center justify-between">
          {editing ? (
            <button
              type="button"
              onClick={handleDelete}
              className="text-sm font-medium text-red-500 hover:underline"
            >
              {t('form.delete')}
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {editing ? t('form.save') : t('form.create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
