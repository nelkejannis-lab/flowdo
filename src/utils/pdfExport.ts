import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import type { Meeting } from '../store/meetingsStore'
import type { MoodboardItem } from '../store/creativeBoardStore'
import type { NotePage } from '../store/brainStore'
import type { CalendarEntry } from '../types'

function slugify(title: string): string {
  return title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'export'
}

function localeFor(language: string) {
  return language === 'en' ? enUS : de
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 14): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[]
  for (const line of lines) {
    if (y > 780) {
      doc.addPage()
      y = 48
    }
    doc.text(line, x, y)
    y += lineHeight
  }
  return y
}

function addHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  return addWrappedText(doc, text, 48, y, 500, 18)
}

function addBody(doc: jsPDF, text: string, y: number): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  return addWrappedText(doc, text, 48, y, 500, 14)
}

function addMeta(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  y = addWrappedText(doc, `${label}:`, 48, y, 500, 13)
  doc.setFont('helvetica', 'normal')
  return addWrappedText(doc, value, 48, y, 500, 14)
}

async function savePdf(doc: jsPDF, filename: string): Promise<void> {
  doc.save(`${slugify(filename)}.pdf`)
}

export async function exportMeetingAsPdf(meeting: Meeting, language = 'de'): Promise<void> {
  const locale = localeFor(language)
  const isDe = language !== 'en'
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = 48

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  y = addWrappedText(doc, meeting.title, 48, y, 500, 24)
  y += 8
  y = addMeta(doc, isDe ? 'Datum' : 'Date', format(new Date(meeting.date), 'dd. MMMM yyyy, HH:mm', { locale }), y)
  y += 10

  y = addHeading(doc, isDe ? 'Zusammenfassung' : 'Summary', y + 4)
  y = addBody(doc, meeting.summary || (isDe ? '(Keine Zusammenfassung)' : '(No summary)'), y + 4)

  const items = meeting.action_items ?? []
  if (items.length > 0) {
    y += 10
    y = addHeading(doc, 'Action Items', y)
    for (const item of items) {
      const check = item.done ? '[x]' : '[ ]'
      const assignee = item.assignee ? ` (@${item.assignee})` : ''
      const due = item.dueDate ? ` — ${isDe ? 'Fällig' : 'Due'}: ${item.dueDate}` : ''
      y = addBody(doc, `${check} ${item.task}${assignee}${due}`, y + 2)
      for (const sub of item.subtasks ?? []) {
        const subCheck = sub.done ? '[x]' : '[ ]'
        y = addBody(doc, `  ${subCheck} ${sub.title}`, y + 2)
      }
    }
  }

  if (meeting.transcript.trim()) {
    y += 10
    y = addHeading(doc, isDe ? 'Transkript' : 'Transcript', y)
    y = addBody(doc, meeting.transcript.trim(), y + 4)
  }

  await savePdf(doc, meeting.title)
}

export async function exportCalendarEntryAsPdf(
  entry: CalendarEntry,
  language = 'de',
  projectName?: string,
): Promise<void> {
  const locale = localeFor(language)
  const isDe = language !== 'en'
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = 48

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  y = addWrappedText(doc, entry.title, 48, y, 500, 24)
  y += 8

  const typeLabel =
    entry.type === 'termin'
      ? isDe ? 'Termin' : 'Appointment'
      : entry.type === 'reise'
        ? isDe ? 'Außerhaus' : 'Off-site'
        : isDe ? 'Urlaub' : 'Vacation'
  y = addMeta(doc, isDe ? 'Typ' : 'Type', typeLabel, y)

  const dateStr = entry.endDate && entry.endDate !== entry.date
    ? `${format(new Date(entry.date), 'dd. MMMM yyyy', { locale })} – ${format(new Date(entry.endDate), 'dd. MMMM yyyy', { locale })}`
    : format(new Date(entry.date), 'dd. MMMM yyyy', { locale })
  y = addMeta(doc, isDe ? 'Datum' : 'Date', dateStr, y)

  if (entry.startTime || entry.endTime) {
    const timeStr = [entry.startTime, entry.endTime].filter(Boolean).join(' – ')
    y = addMeta(doc, isDe ? 'Uhrzeit' : 'Time', `${timeStr}${isDe ? ' Uhr' : ''}`, y)
  }

  if (entry.meetingLink) {
    y = addMeta(doc, isDe ? 'Ort / Link' : 'Location / Link', entry.meetingLink, y)
  }

  if (projectName) {
    y = addMeta(doc, isDe ? 'Projekt' : 'Project', projectName, y)
  }

  if (entry.invitees.length > 0) {
    const names = entry.invitees.map((i) => i.display_name || i.username).join(', ')
    y = addMeta(doc, isDe ? 'Teilnehmer' : 'Attendees', names, y)
  }

  if (entry.description?.trim()) {
    y += 10
    y = addHeading(doc, isDe ? 'Beschreibung' : 'Description', y + 4)
    y = addBody(doc, entry.description.trim(), y + 4)
  }

  await savePdf(doc, entry.title)
}

export async function exportNoteAsPdf(
  page: NotePage,
  opts: { columnTitle?: string; projectName?: string; language?: string } = {},
): Promise<void> {
  const isDe = opts.language !== 'en'
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = 48

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  y = addWrappedText(doc, page.title, 48, y, 500, 24)
  y += 8

  if (opts.columnTitle) {
    y = addMeta(doc, isDe ? 'Kategorie' : 'Category', opts.columnTitle, y)
  }
  if (opts.projectName) {
    y = addMeta(doc, isDe ? 'Projekt' : 'Project', opts.projectName, y)
  }
  if (page.tags?.length) {
    y = addMeta(doc, 'Tags', page.tags.join(', '), y)
  }
  if (page.people?.length) {
    y = addMeta(doc, isDe ? 'Personen' : 'People', page.people.map((p) => p.name).join(', '), y)
  }
  y = addMeta(
    doc,
    isDe ? 'Aktualisiert' : 'Updated',
    format(new Date(page.updatedAt), 'dd.MM.yyyy HH:mm'),
    y,
  )

  y += 10
  y = addHeading(doc, isDe ? 'Inhalt' : 'Content', y + 4)
  y = addBody(doc, page.content || (isDe ? '(Leer)' : '(Empty)'), y + 4)

  if (page.summary?.trim()) {
    y += 10
    y = addHeading(doc, isDe ? 'KI-Zusammenfassung' : 'AI Summary', y)
    y = addBody(doc, page.summary.trim(), y + 4)
  }

  if (page.checklist?.length) {
    y += 10
    y = addHeading(doc, isDe ? 'Checkliste' : 'Checklist', y)
    for (const item of page.checklist) {
      y = addBody(doc, `${item.done ? '[x]' : '[ ]'} ${item.text}`, y + 2)
    }
  }

  await savePdf(doc, page.title)
}

export async function exportMoodboardItemAsPdf(item: MoodboardItem, language = 'de'): Promise<void> {
  const isDe = language !== 'en'
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = 48

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  y = addWrappedText(doc, item.title, 48, y, 500, 24)
  y += 8
  y = addMeta(doc, isDe ? 'Typ' : 'Type', item.type, y)
  y = addMeta(
    doc,
    isDe ? 'Erstellt' : 'Created',
    format(new Date(item.createdAt), 'dd.MM.yyyy HH:mm'),
    y,
  )

  if (item.textContent?.trim()) {
    y += 10
    y = addHeading(doc, isDe ? 'Inhalt' : 'Content', y + 4)
    y = addBody(doc, item.textContent.trim(), y + 4)
  }

  if (item.linkUrl) {
    y += 6
    y = addMeta(doc, 'URL', item.linkUrl, y)
    if (item.metadataHost) y = addMeta(doc, 'Host', item.metadataHost, y)
  }

  const imageUrl = item.imageUrl || item.metadataThumbnail
  if (imageUrl) {
    try {
      const img = await loadImage(imageUrl)
      if (y > 520) {
        doc.addPage()
        y = 48
      }
      const maxW = 500
      const ratio = img.height / img.width
      const w = Math.min(maxW, img.width)
      const h = w * ratio
      doc.addImage(img, 'JPEG', 48, y + 8, w, Math.min(h, 220))
      y += Math.min(h, 220) + 16
    } catch {
      y = addMeta(doc, isDe ? 'Bild' : 'Image', imageUrl, y)
    }
  }

  await savePdf(doc, item.title)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
