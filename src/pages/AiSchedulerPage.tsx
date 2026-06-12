import { useEffect, useState } from 'react'
import { Sparkles, Wand2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { useFriendsStore } from '../store/friendsStore'
import { useAiSchedulerStore, type ParsedAppointment, type ColleagueAvailability } from '../store/aiSchedulerStore'
import { useCalendarEntriesStore } from '../store/calendarEntriesStore'
import { isSupabaseConfigured } from '../lib/supabase'

const DEFAULT_COLOR = '#10B981'

export default function AiSchedulerPage() {
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

  useEffect(() => {
    if (isSupabaseConfigured) fetchFriends()
  }, [fetchFriends])

  function toggleColleague(id: string) {
    setSelectedColleagues((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setParsing(false)
    }
  }

  async function handleCheckAvailability() {
    if (selectedColleagues.length === 0 || !date) return
    setCheckingAvailability(true)
    setError(null)
    try {
      const avail = await checkAvailability(selectedColleagues, date, endDate || null, startTime || null, endTime || null)
      setAvailability(avail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setCheckingAvailability(false)
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
    setSuccess('Termin wurde erstellt.')
    setResult(null)
    setText('')
    setAvailability([])
  }

  return (
    <div>
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold">
        <Sparkles size={22} />
        KI-Termine
      </h1>

      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <h2 className="mb-2 text-sm font-semibold">Termin beschreiben</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="z. B. „Team-Meeting mit Jannis nächsten Dienstag um 14 Uhr, eine Stunde“"
          rows={3}
          className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
        />
        <button
          onClick={handleAnalyze}
          disabled={parsing || !text.trim()}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {parsing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          {parsing ? 'Analysiere…' : 'Termin erkennen'}
        </button>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        {success && <p className="mt-2 text-sm text-emerald-500">{success}</p>}
      </div>

      {result && (
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <h2 className="mb-3 text-sm font-semibold">Vorschau</h2>
          <div className="flex flex-col gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel"
              className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-medium focus:border-accent focus:outline-none dark:border-racing-700"
            />

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">Datum</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">Enddatum (optional)</label>
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
                <label className="mb-1 block text-xs font-medium text-gray-500">Von (Uhrzeit)</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-500">Bis (Uhrzeit)</label>
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
              placeholder="Beschreibung (optional)"
              rows={2}
              className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />

            {friends.length > 0 && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-500">Kollegen einladen</label>
                  <button
                    type="button"
                    onClick={handleCheckAvailability}
                    disabled={selectedColleagues.length === 0 || !date || checkingAvailability}
                    className="text-xs font-medium text-accent hover:underline disabled:opacity-60"
                  >
                    {checkingAvailability ? 'Prüfe…' : 'Verfügbarkeit prüfen'}
                  </button>
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
                            <span title={avail.conflictTitle ?? 'Bereits verplant'}>
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
                    Achtung: Mindestens ein Kollege hat zu dieser Zeit bereits einen Termin.
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
                {creating ? 'Erstelle…' : 'Termin erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
