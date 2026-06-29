import { format, parseISO, getDaysInMonth } from 'date-fns'
import { de } from 'date-fns/locale'
import type { WorkDayEntry, WorkTimePunch, WorkTimeAuditEntry, WorkTimeSettings } from '../types'
import {
  punchesForDay,
  formatPunchTime,
  arbzgWarnings,
  netMinutes,
  dayTargetMinutes,
} from './worktime'

function hm(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const abs = Math.round(Math.abs(minutes))
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
}

// Escape a value for CSV (German Excel uses ';' as the separator and ',' as decimal).
function csv(value: string | number): string {
  const s = String(value)
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const ARBZG_SHORT: Record<string, string> = {
  maxDaily: '>10h (§3)',
  break: 'Pause (§4)',
  rest: 'Ruhezeit (§5)',
}

/**
 * Builds a German "Arbeitszeitnachweis" CSV for one month — the auditable record an
 * employer must keep for at least 2 years (§16 ArbZG / §17 MiLoG). One row per calendar
 * day with punches/worked time, plus a change-log section appended at the end.
 */
export function buildMonthlyTimesheetCsv(
  month: string, // 'yyyy-MM'
  entries: Record<string, WorkDayEntry>,
  punches: WorkTimePunch[],
  auditLog: WorkTimeAuditEntry[],
  settings: WorkTimeSettings,
  employeeName: string
): string {
  const monthDate = parseISO(month + '-01')
  const daysInMonth = getDaysInMonth(monthDate)
  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: de })

  const lines: string[] = []
  lines.push(`Arbeitszeitnachweis;${csv(monthLabel)}`)
  lines.push(`Mitarbeiter:in;${csv(employeeName)}`)
  lines.push(`Erstellt am;${csv(format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de }))}`)
  lines.push('')
  lines.push(
    [
      'Datum',
      'Wochentag',
      'Kommen/Gehen',
      'Brutto',
      'Pause (Min.)',
      'Netto',
      'Soll',
      'Differenz',
      'Krank',
      'ArbZG-Hinweise',
    ]
      .map(csv)
      .join(';')
  )

  let sumNet = 0
  let sumTarget = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${month}-${String(day).padStart(2, '0')}`
    const date = parseISO(iso)
    const entry = entries[iso]
    const dayPunches = punchesForDay(punches, iso)
    if (!entry && dayPunches.length === 0) continue // skip empty days

    const punchStr = dayPunches
      .map((p) => `${p.kind === 'in' ? 'K' : 'G'} ${formatPunchTime(p.punchedAt)}`)
      .join(' · ')
    const net = netMinutes(entry)
    const target = dayTargetMinutes(date, settings)
    sumNet += net
    sumTarget += target

    const warnings = arbzgWarnings(entry).map((w) => ARBZG_SHORT[w.code]).join(', ')

    lines.push(
      [
        format(date, 'dd.MM.yyyy'),
        format(date, 'EEEE', { locale: de }),
        punchStr,
        entry ? hm(entry.workedMinutes) : '',
        entry ? entry.breakMinutes : '',
        entry ? hm(net) : '',
        hm(target),
        entry ? hm(net - target) : '',
        entry?.sickDay ? 'ja' : '',
        warnings,
      ]
        .map(csv)
        .join(';')
    )
  }

  lines.push('')
  lines.push(['Summe', '', '', '', '', hm(sumNet), hm(sumTarget), hm(sumNet - sumTarget), '', ''].map(csv).join(';'))

  // Change log (Manipulationssicherheit — every manual correction is recorded)
  const monthAudit = auditLog.filter((a) => a.entryDate.startsWith(month))
  if (monthAudit.length > 0) {
    lines.push('')
    lines.push('Änderungsprotokoll')
    lines.push(['Datum', 'Geändert am', 'Feld', 'Alt', 'Neu'].map(csv).join(';'))
    for (const a of monthAudit) {
      lines.push(
        [
          format(parseISO(a.entryDate), 'dd.MM.yyyy'),
          format(new Date(a.changedAt), 'dd.MM.yyyy HH:mm', { locale: de }),
          a.field,
          a.oldValue ?? '',
          a.newValue ?? '',
        ]
          .map(csv)
          .join(';')
      )
    }
  }

  return lines.join('\r\n')
}

export function downloadCsv(filename: string, content: string) {
  // Prepend a BOM so German Excel opens the UTF-8 umlauts correctly.
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
