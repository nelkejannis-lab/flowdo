import type { Language } from '../store/settingsStore'

export function buildSickLeaveMailto(params: {
  hrEmail: string
  employeeName: string
  date: string
  language: Language
}): string | null {
  const email = params.hrEmail.trim()
  if (!email) return null

  const isDe = params.language === 'de'
  const subject = isDe
    ? `Krankmeldung: ${params.employeeName} — ${params.date}`
    : `Sick leave notice: ${params.employeeName} — ${params.date}`

  const body = isDe
    ? `Guten Tag,

hiermit melde ich mich krank für den ${params.date}.

Mit freundlichen Grüßen
${params.employeeName}`
    : `Hello,

I am reporting sick leave for ${params.date}.

Best regards
${params.employeeName}`

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function openSickLeaveMail(params: {
  hrEmail: string
  employeeName: string
  date: string
  language: Language
}): boolean {
  const url = buildSickLeaveMailto(params)
  if (!url) return false
  window.location.href = url
  return true
}
