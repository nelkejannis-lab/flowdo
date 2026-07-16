import type { Language } from '../store/settingsStore'
import type { WorkDayEntry, WorkTimePunch, WorkTimeSettings } from '../types'
import { netMinutes } from '../utils/worktime'
import { parsePunchLocation } from '../utils/punchLocation'

export function buildStampedTimesheetText(params: {
  month: string
  employeeName: string
  entries: Record<string, WorkDayEntry>
  punches: WorkTimePunch[]
  settings: WorkTimeSettings
  language: Language
}): string {
  const isDe = params.language === 'de'
  const lines: string[] = [
    isDe ? 'Arbeitszeitnachweis (Stempelprotokoll)' : 'Timesheet (stamp log)',
    `${isDe ? 'Mitarbeiter' : 'Employee'}: ${params.employeeName}`,
    `${isDe ? 'Monat' : 'Month'}: ${params.month}`,
    '',
  ]

  const dates = Object.keys(params.entries)
    .filter((d) => d.startsWith(params.month))
    .sort()

  for (const date of dates) {
    const entry = params.entries[date]
    const dayPunches = params.punches.filter((p) => p.punchedAt.startsWith(date))
    const loc = dayPunches.find((p) => p.kind === 'in' && p.source.startsWith('app'))
    const location = loc ? parsePunchLocation(loc.source) : null
    const locLabel = location === 'homeoffice'
      ? (isDe ? 'Homeoffice' : 'Home office')
      : location === 'office'
        ? (isDe ? 'Büro' : 'Office')
        : '—'
    const net = netMinutes(entry)
    const h = Math.floor(net / 60)
    const m = net % 60
    const sick = entry.sickDay ? (isDe ? ' [Krank]' : ' [Sick]') : ''
    lines.push(`${date} · ${h}:${String(m).padStart(2, '0')} h · ${locLabel}${sick}`)
  }

  lines.push('', isDe ? 'Elektronisch erstellt via NOVAT.' : 'Electronically generated via NOVAT.')
  return lines.join('\n')
}

export function openStampedDocumentMail(params: {
  hrEmail: string
  employeeName: string
  month: string
  body: string
  language: Language
}): boolean {
  const email = params.hrEmail.trim()
  if (!email) return false
  const isDe = params.language === 'de'
  const subject = isDe
    ? `Arbeitszeitnachweis ${params.month} — ${params.employeeName}`
    : `Timesheet ${params.month} — ${params.employeeName}`
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(params.body)}`
  return true
}
