/** Apple / iCloud ICS feeds stored in calendar_connections.ical_url (JSON or plain URL). */

export interface AppleCalendarFeed {
  id: string
  label: string
  url: string
  enabled: boolean
}

export function defaultAppleCalendarFeeds(): AppleCalendarFeed[] {
  return [
    { id: 'work', label: 'Arbeit', url: '', enabled: true },
    { id: 'private', label: 'Privat', url: '', enabled: true },
  ]
}

export function normalizeCalendarUrl(url: string): string {
  return url.trim().replace(/^webcal:\/\//i, 'https://')
}

export function isValidCalendarUrl(url: string): boolean {
  const t = url.trim()
  return t.startsWith('http://') || t.startsWith('https://') || t.startsWith('webcal://')
}

/** Encode feeds for calendar_connections.ical_url (backward-compatible with plain URL). */
export function encodeAppleCalendarFeeds(feeds: AppleCalendarFeed[]): string {
  const active = feeds
    .map((f) => ({ ...f, url: normalizeCalendarUrl(f.url) }))
    .filter((f) => f.url.length > 0)
  if (active.length === 0) return ''
  if (active.length === 1 && active[0].id === 'work') return active[0].url
  return JSON.stringify({
    v: 1,
    feeds: active.map((f) => ({
      id: f.id,
      label: f.label,
      url: f.url,
      enabled: f.enabled !== false,
    })),
  })
}

export function parseAppleCalendarFeeds(raw: string | null | undefined): AppleCalendarFeed[] {
  const defaults = defaultAppleCalendarFeeds()
  if (!raw || !raw.trim()) return defaults
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { feeds?: Partial<AppleCalendarFeed>[] }
      if (!Array.isArray(parsed.feeds)) return defaults
      return defaults.map((d) => {
        const saved = parsed.feeds!.find((f) => f && f.id === d.id)
        if (!saved) return d
        return {
          ...d,
          url: typeof saved.url === 'string' ? saved.url : d.url,
          enabled: saved.enabled !== false,
          label: typeof saved.label === 'string' ? saved.label : d.label,
        }
      })
    } catch {
      return defaults
    }
  }
  // Legacy single URL → Arbeit feed
  return defaults.map((d) => (d.id === 'work' ? { ...d, url: normalizeCalendarUrl(trimmed) } : d))
}

/** Flat list of enabled URLs for sync (edge function + client). */
export function listEnabledAppleFeedUrls(raw: string | null | undefined): { id: string; label: string; url: string }[] {
  const feeds = parseAppleCalendarFeeds(raw)
  return feeds
    .filter((f) => f.enabled !== false && f.url.trim())
    .map((f) => ({ id: f.id, label: f.label, url: normalizeCalendarUrl(f.url) }))
}
