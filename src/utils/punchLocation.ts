/** Encode work location in punch source field (no DB migration needed). */
export type PunchWorkLocation = 'homeoffice' | 'office'

export function punchSourceWithLocation(base: string, location?: PunchWorkLocation | null): string {
  if (!location) return base
  return `${base}:${location}`
}

export function parsePunchLocation(source: string): PunchWorkLocation | null {
  if (source.includes('homeoffice')) return 'homeoffice'
  if (source.includes(':office') || source.endsWith('office')) return 'office'
  return null
}
