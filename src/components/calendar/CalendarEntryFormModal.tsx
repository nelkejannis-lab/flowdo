import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, CalendarHeart, Plane, RefreshCw, Sparkles, Video } from 'lucide-react'
import Modal from '../layout/Modal'
import { detectMeetingProvider, meetingProviderColor } from '../../utils/meetingLink'
import { useEventsStore, EVENT_COLORS, NAMED_COLORS } from '../../store/eventsStore'
import { useCalendarEntriesStore } from '../../store/calendarEntriesStore'
import { useToastStore } from '../../store/toastStore'
import { useFriendsStore } from '../../store/friendsStore'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useTeamsStore } from '../../store/teamsStore'
import { isSupabaseConfigured } from '../../lib/supabase'
import type { CalendarEntry, CalendarEntryType, CalendarEvent } from '../../types'
import { parseCalendarEntryId } from '../../utils/calendarEntry'
import { todayISO } from '../../utils/date'

type Kind = 'event' | CalendarEntryType

interface CalendarEntryFormModalProps {
  event?: CalendarEvent
  entry?: CalendarEntry
  defaultDate?: string
  defaultStartTime?: string
  defaultEndDate?: string
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

const RECURRENCE_OPTIONS = [0, 1, 2, 3, 4, 6, 8] as const
type RecurrenceWeeks = (typeof RECURRENCE_OPTIONS)[number]

function addWeeks(isoDate: string, weeks: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

export default function CalendarEntryFormModal({ event, entry, defaultDate, defaultStartTime, defaultEndDate, onClose }: CalendarEntryFormModalProps) {
  const { t } = useTranslation('calendar')
  const typeOptions: { kind: Kind; label: string; icon: typeof CalendarClock }[] = [
    { kind: 'termin', label: t('form.types.termin'), icon: typeIcons.termin },
    { kind: 'reise', label: t('form.types.reise'), icon: typeIcons.reise },
    { kind: 'event', label: t('form.types.event'), icon: typeIcons.event },
    { kind: 'urlaub', label: t('form.types.urlaub'), icon: typeIcons.urlaub },
  ]
  const addEvent = useEventsStore((s) => s.addEvent)
  const updateEvent = useEventsStore((s) => s.updateEvent)
  const deleteEvent = useEventsStore((s) => s.deleteEvent)
  const addEntry = useCalendarEntriesStore((s) => s.addEntry)
  const updateEntry = useCalendarEntriesStore((s) => s.updateEntry)
  const deleteEntry = useCalendarEntriesStore((s) => s.deleteEntry)
  const friends = useFriendsStore((s) => s.friends)
  const searchAllProfiles = useFriendsStore((s) => s.searchAllProfiles)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)
  const teams = useTeamsStore((s) => s.teams)
  const fetchTeams = useTeamsStore((s) => s.fetch)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const colorLabels = useSettingsStore((s) => s.colorLabels ?? {})
  const setColorLabel = useSettingsStore((s) => s.setColorLabel)

  const editing = event ?? entry
  const initialKind: Kind = event ? 'event' : entry ? entry.type : 'termin'

  const [kind, setKind] = useState<Kind>(initialKind)
  const [title, setTitle] = useState(editing?.title ?? '')
  const [date, setDate] = useState(editing?.date ?? defaultDate ?? todayISO())
  const [endDate, setEndDate] = useState(editing?.endDate ?? defaultEndDate ?? '')
  const [startTime, setStartTime] = useState(entry?.startTime ?? defaultStartTime ?? '')
  const [endTime, setEndTime] = useState(entry?.endTime ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [color, setColor] = useState(editing?.color ?? defaultColors.termin)
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>(() => {
    const existing = entry?.invitees.map((i) => i.id) ?? []
    if (!entry && currentUserId && !existing.includes(currentUserId)) return [currentUserId, ...existing]
    return existing
  })
  const [recurrenceWeeks, setRecurrenceWeeks] = useState<RecurrenceWeeks>(0)
  const [entryRecurrence, setEntryRecurrence] = useState<CalendarEntry['recurrence']>(entry?.recurrence)
  const [meetingLink, setMeetingLink] = useState(entry?.meetingLink ?? '')
  const [colleagueSearch, setColleagueSearch] = useState('')
  const [colleagueResults, setColleagueResults] = useState<{ id: string; display_name: string; avatar_color: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isSupabaseConfigured && !editing) { fetchFriends(); fetchTeams() }
  }, [fetchFriends, fetchTeams, editing])

  useEffect(() => {
    if (!editing && kind !== 'event') {
      setColor(defaultColors[kind])
    } else if (!editing && kind === 'event') {
      setColor(EVENT_COLORS[0])
    }
    if (kind !== 'termin' && kind !== 'reise') setRecurrenceWeeks(0)
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

    const baseInput = {
      type: kind as CalendarEntryType,
      title: title.trim(),
      description: description.trim() || undefined,
      endDate: normalizedEndDate,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      color,
      invitedUserIds,
      recurrence: entryRecurrence,
      meetingLink: meetingLink.trim() || undefined,
    }

    if (entry) {
      const { dbId } = parseCalendarEntryId(entry.id)
      const err = await updateEntry(dbId, { ...baseInput, date })
      setSaving(false)
      if (err) { setError(err); return }
      onClose()
      return
    }

    if (recurrenceWeeks === 0) {
      const err = await addEntry({ ...baseInput, date })
      setSaving(false)
      if (err) { setError(err); return }
      onClose()
      return
    }

    // Create recurring entries for ~1 year
    const occurrences: string[] = []
    let current = date
    const horizon = addWeeks(date, 52)
    while (current <= horizon) {
      occurrences.push(current)
      current = addWeeks(current, recurrenceWeeks)
    }
    for (const d of occurrences) {
      const err = await addEntry({ ...baseInput, date: d })
      if (err) { setSaving(false); setError(err); return }
    }
    setSaving(false)
    onClose()
  }

  const isOwner = !entry || entry.ownerId === currentUserId

  function handleDelete() {
    if (!isOwner) return
    if (event) {
      deleteEvent(event.id)
      onClose()
    } else if (entry) {
      void deleteEntry(entry.id, entry.date)
      useToastStore.getState().show({ message: t('entryDeleted'), duration: 3000 })
      onClose()
    }
  }

  const showRecurrence = !editing && (kind === 'termin' || kind === 'reise')

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
                step="300"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.endTimeOptional')}</label>
              <input
                type="time"
                step="300"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
            </div>
          </div>
        )}

        {(kind === 'termin' || kind === 'reise') && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.meetingLink')}</label>
            <input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder={t('form.meetingLinkPlaceholder')}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
            {meetingLink.trim() && detectMeetingProvider(meetingLink) && (
              <div className="mt-1 flex items-center justify-between">
                <p className="flex items-center gap-1 text-[11px] font-medium" style={{ color: meetingProviderColor(detectMeetingProvider(meetingLink)!.provider) }}>
                  <Video size={11} /> {detectMeetingProvider(meetingLink)!.label}
                </p>
                <a
                  href={meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: meetingProviderColor(detectMeetingProvider(meetingLink)!.provider) }}
                >
                  {t('form.joinMeeting')}
                </a>
              </div>
            )}
          </div>
        )}

        {showRecurrence && (
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <RefreshCw size={12} />
              {t('form.recurrence.label')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {RECURRENCE_OPTIONS.map((w) => (
                <button
                  type="button"
                  key={w}
                  onClick={() => setRecurrenceWeeks(w)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    recurrenceWeeks === w
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-racing-700 dark:text-racing-200'
                  }`}
                >
                  {w === 0 ? t('form.recurrence.none') : t('form.recurrence.everyNWeeks', { count: w })}
                </button>
              ))}
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

        {kind !== 'event' && isSupabaseConfigured && (friends.length > 0 || teams.length > 0) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.inviteColleagues')}</label>
            <div className="flex flex-wrap gap-2">
              {/* Ganzes Team */}
              {friends.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allIds = friends.map((f) => f.profile.id)
                    const allSelected = allIds.every((id) => invitedUserIds.includes(id))
                    setInvitedUserIds(allSelected ? [] : allIds)
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    friends.every((f) => invitedUserIds.includes(f.profile.id))
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-racing-700 dark:text-racing-200'
                  }`}
                >
                  {t('form.wholeTeam')}
                </button>
              )}
              {/* Teams als Gruppe */}
              {teams.map((team) => {
                const memberIds = team.members.map((m) => m.id)
                const allIn = memberIds.length > 0 && memberIds.every((id) => invitedUserIds.includes(id))
                return (
                  <button
                    type="button"
                    key={team.id}
                    onClick={() => {
                      if (allIn) {
                        setInvitedUserIds((ids) => ids.filter((id) => !memberIds.includes(id)))
                      } else {
                        setInvitedUserIds((ids) => [...new Set([...ids, ...memberIds])])
                      }
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      allIn
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-racing-700 dark:text-racing-200'
                    }`}
                  >
                    👥 {team.name}
                  </button>
                )
              })}
            </div>
            {/* Kollegen-Suche (alle Nutzer) */}
            <div className="mt-2">
              <input
                value={colleagueSearch}
                onChange={async (e) => {
                  const q = e.target.value
                  setColleagueSearch(q)
                  if (q.length >= 2) {
                    const results = await searchAllProfiles(q)
                    setColleagueResults(results.map((p) => ({ id: p.id, display_name: p.display_name, avatar_color: p.avatar_color })))
                  } else setColleagueResults([])
                }}
                placeholder={t('form.searchColleagues')}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-xs dark:border-racing-700"
              />
              {colleagueResults.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {colleagueResults.map((p) => (
                    <button key={p.id} type="button" onClick={() => toggleInvitee(p.id)}
                      className={`rounded-full border px-2 py-0.5 text-xs ${invitedUserIds.includes(p.id) ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 text-gray-500'}`}>
                      {p.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Einzelne Kollegen */}
            {friends.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
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
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.color')}</label>
          <div className="flex flex-wrap gap-2">
            {NAMED_COLORS.map((c) => (
              <button
                type="button"
                key={c.hex}
                onClick={() => setColor(c.hex)}
                title={colorLabels[c.hex] ?? c.label}
                className={`flex flex-col items-center gap-0.5 rounded-lg p-1 transition-colors ${color === c.hex ? 'bg-gray-100 dark:bg-racing-800' : 'hover:bg-gray-50 dark:hover:bg-racing-800/50'}`}
              >
                <span
                  className={`h-6 w-6 rounded-full border-2 ${color === c.hex ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-[9px] leading-none text-gray-500 dark:text-racing-300">{colorLabels[c.hex] ?? c.label}</span>
              </button>
            ))}
          </div>
          {color && NAMED_COLORS.some((c) => c.hex === color) && (
            <div className="mt-2 flex items-center gap-2">
              <span className="h-4 w-4 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <input
                type="text"
                value={colorLabels[color] ?? NAMED_COLORS.find((c) => c.hex === color)?.label ?? ''}
                onChange={(e) => setColorLabel(color, e.target.value)}
                placeholder={t('form.colorLabelPlaceholder')}
                className="flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-xs focus:border-accent focus:outline-none dark:border-racing-700"
              />
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Wiederholung / Recurrence</label>
          <select
            value={entryRecurrence ?? ''}
            onChange={(e) => setEntryRecurrence((e.target.value as CalendarEntry['recurrence']) || undefined)}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          >
            <option value="">Keine / None</option>
            <option value="daily">Täglich / Daily</option>
            <option value="weekly">Wöchentlich / Weekly</option>
            <option value="monthly">Monatlich / Monthly</option>
            <option value="yearly">Jährlich / Yearly</option>
          </select>
        </div>

        {recurrenceWeeks > 0 && !editing && (
          <p className="rounded-lg bg-accent/5 px-3 py-2 text-xs text-accent">
            {t('form.recurrence.hint', {
              count: Math.floor(52 / recurrenceWeeks) + 1,
              weeks: recurrenceWeeks,
            })}
          </p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="mt-2 flex items-center justify-between">
          {editing && isOwner ? (
            <button
              type="button"
              onClick={handleDelete}
              className="text-sm font-medium text-red-500 hover:underline"
            >
              {t('form.delete')}
            </button>
          ) : editing && !isOwner ? (
            <span className="text-xs text-gray-400">{t('ownerOnly')}</span>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={saving || (!!editing && !isOwner)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {saving
              ? t('form.creating')
              : editing
              ? t('form.save')
              : recurrenceWeeks > 0
              ? t('form.createSeries')
              : t('form.create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
