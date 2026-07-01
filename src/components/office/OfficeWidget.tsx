import { useEffect } from 'react'
import { Home, Building2, Users, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOfficeStore } from '../../store/officeStore'

export default function OfficeWidget() {
  const { t } = useTranslation('dashboard')
  const todayEntry = useOfficeStore((s) => s.todayEntry)
  const colleagueEntries = useOfficeStore((s) => s.colleagueEntries)
  const loading = useOfficeStore((s) => s.loading)
  const fetchToday = useOfficeStore((s) => s.fetchToday)
  const setLocation = useOfficeStore((s) => s.setLocation)

  useEffect(() => { fetchToday() }, [])

  const isHome = todayEntry?.location === 'homeoffice'
  const isOffice = todayEntry?.location === 'office'
  const officeColleagues = colleagueEntries.filter((c) => c.location === 'office')
  const homeColleagues = colleagueEntries.filter((c) => c.location === 'homeoffice')

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <Users size={12} /> {t('officeWidget.office')} / {t('officeWidget.homeoffice')}
        </span>
        <button
          onClick={fetchToday}
          className="text-gray-300 hover:text-gray-500"
          title={t('officeWidget.refresh')}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* My status */}
      <div className="flex gap-2">
        <button
          onClick={() => setLocation('homeoffice')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            isHome
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:bg-racing-800 dark:text-racing-300'
          }`}
        >
          <Home size={13} /> {t('officeWidget.homeoffice')}
        </button>
        <button
          onClick={() => setLocation('office')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            isOffice
              ? 'bg-indigo-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-racing-800 dark:text-racing-300'
          }`}
        >
          <Building2 size={13} /> {t('officeWidget.office')}
        </button>
      </div>

      {todayEntry?.note && (
        <p className="text-[11px] text-gray-400 italic">"{todayEntry.note}"</p>
      )}

      {/* Colleagues */}
      {colleagueEntries.length > 0 && (
        <div className="space-y-2">
          {officeColleagues.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-400">
                {t('officeWidget.inOffice', { count: officeColleagues.length })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {officeColleagues.map((c) => (
                  <ColleagueChip key={c.id} entry={c} color="indigo" />
                ))}
              </div>
            </div>
          )}
          {homeColleagues.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-400">
                {t('officeWidget.homeofficeCount', { count: homeColleagues.length })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {homeColleagues.map((c) => (
                  <ColleagueChip key={c.id} entry={c} color="blue" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!todayEntry && !loading && (
        <p className="text-center text-[11px] text-gray-400">
          {t('officeWidget.noStatusToday')}
        </p>
      )}
    </div>
  )
}

function ColleagueChip({ entry, color }: { entry: { displayName?: string; avatarUrl?: string }; color: 'indigo' | 'blue' }) {
  const bg = color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
  const text = color === 'indigo' ? 'text-indigo-700 dark:text-indigo-300' : 'text-blue-700 dark:text-blue-300'
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${bg} ${text}`}>
      {entry.avatarUrl ? (
        <img src={entry.avatarUrl} className="h-3.5 w-3.5 rounded-full object-cover" alt="" />
      ) : (
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-current/20 text-[8px] font-bold">
          {(entry.displayName ?? '?')[0].toUpperCase()}
        </span>
      )}
      {entry.displayName}
    </span>
  )
}
