import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Wand2, CheckCircle2, AlertTriangle, Loader2, Calendar, Users } from 'lucide-react'
import { useFriendsStore } from '../store/friendsStore'
import { useAiSchedulerStore, type ParsedAppointment, type ColleagueAvailability, type BestSlotResult } from '../store/aiSchedulerStore'
import { useCalendarEntriesStore } from '../store/calendarEntriesStore'
import { isSupabaseConfigured } from '../lib/supabase'
import AiChatPanel from '../components/ai/AiChatPanel'

const DEFAULT_COLOR = '#10B981'

export default function AiSchedulerPage() {
  const { t, i18n } = useTranslation('aiScheduler')
  const friends = useFriendsStore((s) => s.friends)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)
  const parseAppointment = useAiSchedulerStore((s) => s.parseAppointment)
  const checkAvailability = useAiSchedulerStore((s) => s.checkAvailability)
  const addEntry = useCalendarEntriesStore((s) => s.addEntry)

  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [result, setResult] = useState<ParsedAppointment | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [selectedColleagues, setSelectedColleagues] = useState<string[]>([])

  const [availability, setAvailability] = useState<ColleagueAvailability[]>([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [creating, setCreating] = useState(false)

  // Best slot finder
  const getBusySlots = useAiSchedulerStore((s) => s.getBusySlots)
  const findBestSlot = useAiSchedulerStore((s) => s.findBestSlot)
  const [finderColleagues, setFinderColleagues] = useState<string[]>([])
  const [finderSearch, setFinderSearch] = useState('')
  const [finderFromDate, setFinderFromDate] = useState('')
  const [finderToDate, setFinderToDate] = useState('')
  const [finderDuration, setFinderDuration] = useState('60')
  const [finderPrefStart, setFinderPrefStart] = useState('09:00')
  const [finderPrefEnd, setFinderPrefEnd] = useState('18:00')
  const [findingSlot, setFindingSlot] = useState(false)
  const [bestSlot, setBestSlot] = useState<BestSlotResult | null>(null)
  const [finderError, setFinderError] = useState<string | null>(null)

  // @-mention autocomplete
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState(0)

  const mentionSuggestions = mentionQuery !== null
    ? friends.filter((f) =>
        f.profile.display_name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        f.profile.username.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 5)
    : []

  useEffect(() => {
    if (isSupabaseConfigured) fetchFriends()
  }, [fetchFriends])

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setText(val)

    const cursor = e.target.selectionStart ?? val.length
    const textUpToCursor = val.slice(0, cursor)
    const atMatch = textUpToCursor.match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionStart(cursor - atMatch[0].length)
    } else {
      setMentionQuery(null)
    }
  }

  function insertMention(displayName: string) {
    const cursor = textareaRef.current?.selectionStart ?? text.length
    const before = text.slice(0, mentionStart)
    const after = text.slice(cursor)
    const newText = `${before}@${displayName} ${after}`
    setText(newText)
    setMentionQuery(null)
    setTimeout(() => {
      const pos = mentionStart + displayName.length + 2
      textareaRef.current?.setSelectionRange(pos, pos)
      textareaRef.current?.focus()
    }, 0)
  }

  function toggleColleague(id: string) {
    setSelectedColleagues((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  }

  function addFinderColleague(id: string) {
    setFinderColleagues((ids) => ids.includes(id) ? ids : [...ids, id])
    setFinderSearch('')
  }

  function removeFinderColleague(id: string) {
    setFinderColleagues((ids) => ids.filter((x) => x !== id))
  }

  const finderSearchResults = finderSearch.trim()
    ? friends.filter(
        (f) =>
          !finderColleagues.includes(f.profile.id) &&
          (f.profile.display_name.toLowerCase().includes(finderSearch.toLowerCase()) ||
            f.profile.username.toLowerCase().includes(finderSearch.toLowerCase()))
      ).slice(0, 5)
    : []

  async function handleFindBestSlot() {
    if (finderColleagues.length === 0 || !finderFromDate || !finderToDate) return
    setFindingSlot(true)
    setFinderError(null)
    setBestSlot(null)
    try {
      const colleagues = friends
        .filter((f) => finderColleagues.includes(f.profile.id))
        .map((f) => ({ id: f.profile.id, name: f.profile.display_name }))
      const busySlots = await getBusySlots(finderColleagues, finderFromDate, finderToDate, colleagues)
      const result = await findBestSlot(
        colleagues,
        busySlots,
        finderFromDate,
        finderToDate,
        parseInt(finderDuration) || 60,
        finderPrefStart || null,
        finderPrefEnd || null,
      )
      setBestSlot(result)
    } catch (err) {
      setFinderError(err instanceof Error ? err.message : t('errors.unknown'))
    } finally {
      setFindingSlot(false)
    }
  }

  function applyBestSlot() {
    if (!bestSlot) return
    setDate(bestSlot.date)
    setStartTime(bestSlot.startTime)
    setEndTime(bestSlot.endTime)
    setSelectedColleagues(finderColleagues)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function runAvailabilityCheck(ids: string[], d: string, ed: string, st: string, et: string) {
    if (ids.length === 0 || !d) return
    setCheckingAvailability(true)
    try {
      const avail = await checkAvailability(ids, d, ed || null, st || null, et || null)
      setAvailability(avail)
    } catch {
      // non-blocking, ignore
    } finally {
      setCheckingAvailability(false)
    }
  }

  async function handleAnalyze() {
    if (!text.trim()) return
    setError(null)
    setSuccess(null)
    setParsing(true)
    setAvailability([])
    try {
      const colleagues = friends.map((f) => ({ id: f.profile.id, name: f.profile.display_name }))
      const parsed = await parseAppointment(text, colleagues)
      if (!parsed) return
      setResult(parsed)
      setTitle(parsed.title)
      setDescription(parsed.description ?? '')
      setDate(parsed.date)
      setEndDate(parsed.endDate ?? '')
      setStartTime(parsed.startTime ?? '')
      setEndTime(parsed.endTime ?? '')
      setSelectedColleagues(parsed.colleagueIds)

      // Automatically check availability for detected colleagues
      if (parsed.colleagueIds.length > 0 && parsed.date) {
        await runAvailabilityCheck(parsed.colleagueIds, parsed.date, parsed.endDate ?? '', parsed.startTime ?? '', parsed.endTime ?? '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'))
    } finally {
      setParsing(false)
    }
  }

  async function handleCreate() {
    if (!title.trim() || !date) return
    setCreating(true)
    setError(null)
    const err = await addEntry({
      type: 'termin',
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      endDate: endDate || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      color: DEFAULT_COLOR,
      invitedUserIds: selectedColleagues,
    })
    setCreating(false)
    if (err) {
      setError(err)
      return
    }
    setSuccess(t('success.created'))
    setResult(null)
    setText('')
    setAvailability([])
  }

  return (
    <div>
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold">
        <Sparkles size={22} />
        {t('title')}
      </h1>

      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <h2 className="mb-2 text-sm font-semibold">{t('describe.heading')}</h2>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if (mentionQuery !== null && mentionSuggestions.length > 0 && e.key === 'Escape') {
                setMentionQuery(null)
              }
            }}
            placeholder={t('describe.placeholder')}
            rows={3}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
          {mentionQuery !== null && mentionSuggestions.length > 0 && (
            <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-racing-700 dark:bg-racing-900">
              {mentionSuggestions.map((f) => (
                <button
                  key={f.profile.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertMention(f.profile.display_name) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-racing-800"
                >
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: f.profile.avatar_color }}
                  >
                    {f.profile.display_name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="font-medium">{f.profile.display_name}</span>
                  <span className="ml-auto text-xs text-gray-400">@{f.profile.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1.5 text-xs text-gray-400">{t('describe.mentionTip')}</p>
        <button
          onClick={handleAnalyze}
          disabled={parsing || !text.trim()}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {parsing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          {parsing ? t('describe.analyzing') : t('describe.analyze')}
        </button>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        {success && <p className="mt-2 text-sm text-emerald-500">{success}</p>}
      </div>

      {friends.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Users size={15} />
            {t('finder.heading')}
          </h2>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('finder.participants')}</label>
            <div className="relative">
              <input
                type="text"
                value={finderSearch}
                onChange={(e) => setFinderSearch(e.target.value)}
                placeholder={t('finder.searchPlaceholder')}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
              {finderSearchResults.length > 0 && (
                <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-racing-700 dark:bg-racing-900">
                  {finderSearchResults.map((f) => (
                    <button
                      key={f.profile.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); addFinderColleague(f.profile.id) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-racing-800"
                    >
                      <span
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: f.profile.avatar_color }}
                      >
                        {f.profile.display_name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="font-medium">{f.profile.display_name}</span>
                      <span className="ml-auto text-xs text-gray-400">@{f.profile.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {finderColleagues.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {finderColleagues.map((id) => {
                  const f = friends.find((x) => x.profile.id === id)
                  if (!f) return null
                  return (
                    <span key={id} className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                      {f.profile.display_name}
                      <button type="button" onClick={() => removeFinderColleague(id)} className="ml-0.5 hover:text-red-500">×</button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mb-3 flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('finder.from')}</label>
              <input
                type="date"
                value={finderFromDate}
                onChange={(e) => setFinderFromDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('finder.to')}</label>
              <input
                type="date"
                value={finderToDate}
                min={finderFromDate}
                onChange={(e) => setFinderToDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
            </div>
          </div>

          <div className="mb-3 flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('finder.durationMinutes')}</label>
              <input
                type="number"
                value={finderDuration}
                min={15}
                step={15}
                onChange={(e) => setFinderDuration(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('finder.preferredFrom')}</label>
              <input
                type="time"
                value={finderPrefStart}
                onChange={(e) => setFinderPrefStart(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('finder.to')}</label>
              <input
                type="time"
                value={finderPrefEnd}
                onChange={(e) => setFinderPrefEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
            </div>
          </div>

          <button
            onClick={handleFindBestSlot}
            disabled={findingSlot || finderColleagues.length === 0 || !finderFromDate || !finderToDate}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {findingSlot ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
            {findingSlot ? t('finder.searching') : t('finder.findBestSlot')}
          </button>

          {finderError && <p className="mt-2 text-sm text-red-500">{finderError}</p>}

          {bestSlot && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={14} className="mr-1 inline" />
                    {new Date(bestSlot.date).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                    {' · '}{bestSlot.startTime} – {bestSlot.endTime}{t('uhr') ? ` ${t('uhr')}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-500">{bestSlot.explanation}</p>
                </div>
                <button
                  onClick={applyBestSlot}
                  className="flex-shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-transparent dark:text-emerald-400"
                >
                  {t('finder.apply')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <h2 className="mb-3 text-sm font-semibold">{t('preview.heading')}</h2>
          <div className="flex flex-col gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('preview.titlePlaceholder')}
              className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-medium focus:border-accent focus:outline-none dark:border-racing-700"
            />

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">{t('preview.date')}</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">{t('preview.endDateOptional')}</label>
                <input
                  type="date"
                  value={endDate}
                  min={date}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">{t('preview.startTime')}</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">{t('preview.endTime')}</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
              </div>
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('preview.descriptionPlaceholder')}
              rows={2}
              className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />

            {friends.length > 0 && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-500">{t('preview.inviteColleagues')}</label>
                  {checkingAvailability && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Loader2 size={12} className="animate-spin" /> {t('preview.checkingAvailability')}
                    </span>
                  )}
                  {!checkingAvailability && selectedColleagues.length > 0 && date && (
                    <button
                      type="button"
                      onClick={() => runAvailabilityCheck(selectedColleagues, date, endDate, startTime, endTime)}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      {t('preview.recheck')}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {friends.map((f) => {
                    const active = selectedColleagues.includes(f.profile.id)
                    const avail = availability.find((a) => a.userId === f.profile.id)
                    return (
                      <button
                        type="button"
                        key={f.profile.id}
                        onClick={() => toggleColleague(f.profile.id)}
                        className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          active
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-racing-700 dark:text-racing-200'
                        }`}
                      >
                        {f.profile.display_name}
                        {avail && (
                          avail.busy ? (
                            <span title={avail.conflictTitle ?? t('preview.conflictTitle')}>
                              <AlertTriangle size={12} className="text-amber-500" />
                            </span>
                          ) : (
                            <CheckCircle2 size={12} className="text-emerald-500" />
                          )
                        )}
                      </button>
                    )
                  })}
                </div>
                {availability.some((a) => a.busy) && (
                  <p className="mt-2 text-xs text-amber-500">
                    {t('preview.conflictWarning')}
                  </p>
                )}
              </div>
            )}

            <div className="mt-2 flex justify-end">
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim() || !date}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
              >
                {creating ? t('preview.creating') : t('preview.createAppointment')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AiChatPanel />
    </div>
  )
}
