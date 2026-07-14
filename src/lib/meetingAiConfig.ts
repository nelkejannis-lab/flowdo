export type MeetingAiQuality = 'economy' | 'balanced' | 'quality'

const STORAGE_KEY = 'meeting-ai-quality'

export interface MeetingAiSettings {
  quality: MeetingAiQuality
  model: string
  maxTokens: number
  analysisIntervalMs: number
  minNewChars: number
  maxTranscriptChars: number
}

const QUALITY_PRESETS: Record<MeetingAiQuality, Omit<MeetingAiSettings, 'quality'>> = {
  economy: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
    analysisIntervalMs: 120_000,
    minNewChars: 600,
    maxTranscriptChars: 6_000,
  },
  balanced: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1536,
    analysisIntervalMs: 90_000,
    minNewChars: 400,
    maxTranscriptChars: 10_000,
  },
  quality: {
    model: 'claude-sonnet-4-6',
    maxTokens: 2048,
    analysisIntervalMs: 60_000,
    minNewChars: 250,
    maxTranscriptChars: 16_000,
  },
}

export function getMeetingAiQuality(): MeetingAiQuality {
  if (typeof window === 'undefined') return 'economy'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'balanced' || stored === 'quality') return stored
  return 'economy'
}

export function setMeetingAiQuality(quality: MeetingAiQuality): void {
  localStorage.setItem(STORAGE_KEY, quality)
}

export function getMeetingAiSettings(quality = getMeetingAiQuality()): MeetingAiSettings {
  return { quality, ...QUALITY_PRESETS[quality] }
}

/** Rough USD estimate for UI (Haiku ~$0.25/$1.25 per Mtok, Sonnet ~$3/$15). */
export function estimateMeetingAiCostUsd(
  analysisCount: number,
  quality: MeetingAiQuality = getMeetingAiQuality(),
): number {
  const perCall =
    quality === 'quality'
      ? { input: 0.004, output: 0.003 }
      : { input: 0.0003, output: 0.0004 }
  return analysisCount * (perCall.input + perCall.output)
}
