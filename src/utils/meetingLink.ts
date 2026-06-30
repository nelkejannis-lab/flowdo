export type MeetingProvider = 'teams' | 'zoom' | 'meet' | 'webex' | 'other'

export interface MeetingInfo {
  provider: MeetingProvider
  label: string
}

// Detect the conferencing provider from a meeting URL so we can show the right
// icon/label (Teams, Zoom, Google Meet, …) on a calendar entry.
export function detectMeetingProvider(url?: string): MeetingInfo | null {
  if (!url) return null
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    // not a full URL — fall back to substring matching on the raw string
    host = url.toLowerCase()
  }
  if (host.includes('teams.microsoft') || host.includes('teams.live')) return { provider: 'teams', label: 'Microsoft Teams' }
  if (host.includes('zoom.us') || host.includes('zoom.com')) return { provider: 'zoom', label: 'Zoom' }
  if (host.includes('meet.google')) return { provider: 'meet', label: 'Google Meet' }
  if (host.includes('webex')) return { provider: 'webex', label: 'Webex' }
  return { provider: 'other', label: 'Meeting' }
}

export function meetingProviderColor(provider: MeetingProvider): string {
  switch (provider) {
    case 'teams': return '#5059C9'
    case 'zoom': return '#2D8CFF'
    case 'meet': return '#00897B'
    case 'webex': return '#005073'
    default: return '#6B7280'
  }
}
