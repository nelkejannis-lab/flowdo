import type { Meeting } from '../store/meetingsStore'

export function meetingShareUrl(meetingId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/meetings?meeting=${encodeURIComponent(meetingId)}`
}

export function buildMeetingInviteMailto(meeting: Meeting, language: 'de' | 'en'): string {
  const isDe = language === 'de'
  const subject = isDe ? `Meeting-Protokoll: ${meeting.title}` : `Meeting notes: ${meeting.title}`
  const link = meetingShareUrl(meeting.id)
  const summary = meeting.summary?.trim() || (isDe ? '(Keine Zusammenfassung)' : '(No summary)')
  const body = isDe
    ? `Hallo,

hier ist das Protokoll zu „${meeting.title}“:

${summary}

Link: ${link}`
    : `Hi,

here are the notes for "${meeting.title}":

${summary}

Link: ${link}`

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
