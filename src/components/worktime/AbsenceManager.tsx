import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarHeart, Thermometer, Clock } from 'lucide-react'
import type { AbsenceType } from '../../types'
import { useWorkTimeStore } from '../../store/workTimeStore'

const TYPE_ICONS: Record<AbsenceType, typeof CalendarHeart> = {
  vacation: CalendarHeart,
  sick: Thermometer,
  overtime: Clock,
}

export default function AbsenceManager() {
  const { t } = useTranslation('worktime')
  const addAbsencePeriod = useWorkTimeStore((s) => s.addAbsencePeriod)
  const absencePeriods = useWorkTimeStore((s) => s.absencePeriods)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [type, setType] = useState<AbsenceType>('vacation')
  const [note, setNote] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate) return
    addAbsencePeriod(startDate, endDate, type, note.trim() || undefined)
    setStartDate('')
    setEndDate('')
    setNote('')
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      <h3 className="mb-3 text-sm font-semibold">{t('absence.title')}</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          {(['vacation', 'sick', 'overtime'] as AbsenceType[]).map((tpe) => {
            const Icon = TYPE_ICONS[tpe]
            return (
              <button
                key={tpe}
                type="button"
                onClick={() => setType(tpe)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                  type === tpe ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 text-gray-500 dark:border-racing-700'
                }`}
              >
                <Icon size={12} />
                {t(`absence.types.${tpe}`)}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
            className="flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm dark:border-racing-700" />
          <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required
            className="flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm dark:border-racing-700" />
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('absence.notePlaceholder')}
          className="rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm dark:border-racing-700" />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-dark">
          {t('absence.save')}
        </button>
      </form>
      {absencePeriods.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 border-t border-gray-100 pt-2 dark:border-racing-800">
          {absencePeriods.slice(0, 5).map((p) => (
            <li key={p.id} className="text-xs text-gray-500">
              {p.startDate} – {p.endDate} · {t(`absence.types.${p.type}`)}
              {p.note ? ` · ${p.note}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
