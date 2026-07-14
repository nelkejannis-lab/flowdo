import { format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import type { Meeting } from '../store/meetingsStore'

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

export function meetingToMarkdown(meeting: Meeting, language = 'de'): string {
  const locale = language === 'en' ? enUS : de
  const dateStr = format(new Date(meeting.date), 'dd. MMMM yyyy, HH:mm', { locale })
  const lines: string[] = [
    `# ${meeting.title}`,
    '',
    `**${language === 'en' ? 'Date' : 'Datum'}:** ${dateStr}`,
    '',
    `## ${language === 'en' ? 'Summary' : 'Zusammenfassung'}`,
    '',
    meeting.summary || (language === 'en' ? '_No summary._' : '_Keine Zusammenfassung._'),
    '',
  ]

  const items = meeting.action_items ?? []
  if (items.length > 0) {
    lines.push(`## ${language === 'en' ? 'Action Items' : 'Action Items'}`, '')
    for (const item of items) {
      const check = item.done ? 'x' : ' '
      const assignee = item.assignee ? ` (@${item.assignee})` : ''
      const due = item.dueDate ? ` — ${language === 'en' ? 'Due' : 'Fällig'}: ${item.dueDate}` : ''
      lines.push(`- [${check}] ${item.task}${assignee}${due}`)
      for (const sub of item.subtasks ?? []) {
        const subCheck = sub.done ? 'x' : ' '
        lines.push(`  - [${subCheck}] ${sub.title}`)
      }
    }
    lines.push('')
  }

  if (meeting.transcript.trim()) {
    lines.push(`## ${language === 'en' ? 'Transcript' : 'Transkript'}`, '', meeting.transcript.trim(), '')
  }

  return lines.join('\n')
}

export async function copyMeetingMarkdown(meeting: Meeting, language = 'de'): Promise<void> {
  await navigator.clipboard.writeText(meetingToMarkdown(meeting, language))
}

export function downloadMeetingMarkdown(meeting: Meeting, language = 'de'): void {
  const md = meetingToMarkdown(meeting, language)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const slug = meeting.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'meeting'
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug}.md`
  a.click()
  URL.revokeObjectURL(url)
}
