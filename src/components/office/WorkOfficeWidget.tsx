import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Home, Building2, Play, Square, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { useOfficeStore } from '../../store/officeStore'
import { todayISO } from '../../utils/date'
import { dayTargetMinutes, formatHM, netMinutes } from '../../utils/worktime'

export default function WorkOfficeWidget() {
  const isRunning = useWorkTimeStore((s) => s.isRunning)
  const runningStartedAt = useWorkTimeStore((s) => s.runningStartedAt)
  const entries = useWorkTimeStore((s) => s.entries)
  const settings = useWorkTimeStore((s) => s.settings)
  const clockIn = useWorkTimeStore((s) => s.clockIn)
  const clockOut = useWorkTimeStore((s) => s.clockOut)

  const todayEntry = useOfficeStore((s) => s.todayEntry)
  const colleagueEntries = useOfficeStore((s) => s.colleagueEntries)
  const setLocation = useOfficeStore((s) => s.setLocation)
  const fetchToday = useOfficeStore((s) => s.fetchToday)

  const [showColleagues, setShowColleagues] = useState(false)
  const [, tick] = useState(0)

  useEffect(() => { fetchToday() }, [])
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [isRunning])

  const today = todayISO()
  const entry = entries[today]
  const isSick = entry?.sickDay ?? false
  const liveMinutes = isRunning && runningStartedAt
    ? (Date.now() - new Date(runningStartedAt).getTime()) / 60000 : 0
  const net = netMinutes(entry) + liveMinutes
  const target = dayTargetMinutes(new Date(), settings)
  const diff = net - target
  const progress = target > 0 ? Math.min(100, (net / target) * 100) : 0
  const circumference = 2 * Math.PI * 22

  const isHome = todayEntry?.location === 'homeoffice'
  const isOffice = todayEntry?.location === 'office'
  const officeColleagues = colleagueEntries.filter((c) => c.location === 'office')
  const homeColleagues = colleagueEntries.filter((c) => c.location === 'homeoffice')
  const totalColleagues = colleagueEntries.length

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Arbeitszeit & Standort</span>
        {isRunning && (
          <span className="flex items-center gap-1 text-xs font-medium text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> Läuft
          </span>
        )}
        {isSick && <span className="text-xs font-medium text-amber-500">🤒 Krank</span>}
      </div>

      {/* Location toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setLocation('homeoffice')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            isHome ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:bg-racing-800 dark:text-racing-300'
          }`}
        >
          <Home size={12} /> Homeoffice
        </button>
        <button
          onClick={() => setLocation('office')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            isOffice ? 'bg-indigo-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-racing-800 dark:text-racing-300'
          }`}
        >
          <Building2 size={12} /> Büro
        </button>
      </div>

      {/* Arbeitszeit row */}
      <Link to="/arbeitszeit" className="flex items-center gap-3 group">
        {/* Ring */}
        <div className="relative flex-shrink-0">
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="4" />
            <circle
              cx="26" cy="26" r="22"
              fill="none"
              stroke={isSick ? '#f59e0b' : diff >= 0 ? '#10b981' : '#6366f1'}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress / 100)}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Time stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold tabular-nums">{formatHM(net)}</span>
            <span className="text-xs text-gray-400">/ {formatHM(target)}</span>
          </div>
          <div className={`text-xs font-medium ${diff >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {diff === 0 ? 'Auf Soll' : `${diff > 0 ? '+' : ''}${formatHM(diff)} ${diff > 0 ? 'Überstunden' : 'fehlen noch'}`}
          </div>
        </div>

        {/* Clock button */}
        {!isSick && (
          <button
            onClick={(e) => { e.preventDefault(); isRunning ? clockOut() : clockIn() }}
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white shadow ${
              isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-accent hover:bg-accent-dark'
            }`}
          >
            {isRunning ? <Square size={13} /> : <Play size={14} className="ml-0.5" />}
          </button>
        )}
      </Link>

      {/* Colleagues toggle */}
      {totalColleagues > 0 && (
        <button
          onClick={() => setShowColleagues((v) => !v)}
          className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 dark:bg-racing-800 dark:text-racing-300"
        >
          <span className="flex items-center gap-1.5">
            <Users size={11} /> {totalColleagues} Kollege{totalColleagues !== 1 ? 'n' : ''} heute aktiv
          </span>
          {showColleagues ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}

      {showColleagues && (
        <div className="space-y-2">
          {officeColleagues.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-400">
                Im Büro ({officeColleagues.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {officeColleagues.map((c) => <ColleagueChip key={c.id} entry={c} color="indigo" />)}
              </div>
            </div>
          )}
          {homeColleagues.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-400">
                Homeoffice ({homeColleagues.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {homeColleagues.map((c) => <ColleagueChip key={c.id} entry={c} color="blue" />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ColleagueChip({ entry, color }: { entry: { id: string; displayName?: string; avatarUrl?: string }; color: 'indigo' | 'blue' }) {
  const bg = color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
  const text = color === 'indigo' ? 'text-indigo-700 dark:text-indigo-300' : 'text-blue-700 dark:text-blue-300'
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${bg} ${text}`}>
      {entry.avatarUrl
        ? <img src={entry.avatarUrl} className="h-3.5 w-3.5 rounded-full object-cover" alt="" />
        : <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-current/20 text-[8px] font-bold">{(entry.displayName ?? '?')[0].toUpperCase()}</span>
      }
      {entry.displayName}
    </span>
  )
}
