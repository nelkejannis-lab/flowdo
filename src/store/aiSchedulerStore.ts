import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

export interface ParsedAppointment {
  title: string
  description: string | null
  date: string
  endDate: string | null
  startTime: string | null
  endTime: string | null
  colleagueIds: string[]
}

export interface ColleagueAvailability {
  userId: string
  busy: boolean
  conflictTitle: string | null
}

interface AvailabilityRow {
  user_id: string
  busy: boolean
  conflict_title: string | null
}

interface AiSchedulerState {
  loading: boolean
  error: string | null
  parseAppointment: (
    text: string,
    colleagues: { id: string; name: string }[]
  ) => Promise<ParsedAppointment | null>
  checkAvailability: (
    userIds: string[],
    date: string,
    endDate: string | null,
    startTime: string | null,
    endTime: string | null
  ) => Promise<ColleagueAvailability[]>
}

export const useAiSchedulerStore = create<AiSchedulerState>()(() => ({
  loading: false,
  error: null,

  parseAppointment: async (text, colleagues) => {
    const today = new Date()
    const todayIso = format(today, 'yyyy-MM-dd')
    const weekday = format(today, 'EEEE', { locale: de })

    const colleagueList =
      colleagues.length > 0
        ? colleagues.map((c) => `- ${c.name} (id: ${c.id})`).join('\n')
        : '(keine Kollegen vorhanden)'

    const systemPrompt = `Du wandelst eine deutsche Terminbeschreibung in JSON um.
Heutiges Datum: ${todayIso} (${weekday}).
Bekannte Kollegen:
${colleagueList}

Antworte AUSSCHLIESSLICH mit kompaktem JSON ohne weiteren Text, in genau diesem Format:
{
  "title": string,
  "description": string oder null,
  "date": "yyyy-MM-dd",
  "endDate": "yyyy-MM-dd" oder null (nur bei mehrtägigen Terminen),
  "startTime": "HH:MM" oder null,
  "endTime": "HH:MM" oder null,
  "colleagueIds": string[] (ids aus der Kollegen-Liste, die im Text erwähnt werden)
}

Regeln:
- Löse relative Datums-/Zeitangaben ("morgen", "übermorgen", "nächsten Dienstag", "in zwei Wochen") anhand des heutigen Datums auf.
- Wenn eine Dauer angegeben ist (z. B. "für eine Stunde") aber keine Endzeit, berechne endTime.
- Erkenne erwähnte Kollegen nur anhand der obigen Liste (Name oder Teil davon) und gib ihre ids zurück. Erfinde keine ids.
- Wenn keine Uhrzeit erkennbar ist, setze startTime und endTime auf null.
- title soll kurz und prägnant sein.`

    const { data, error } = await supabase.functions.invoke('ai-scheduler', {
      body: { text, systemPrompt },
    })

    if (error) {
      throw new Error(error.message ?? 'Anfrage an den KI-Terminmanager fehlgeschlagen')
    }
    if (data?.error) {
      throw new Error(typeof data.error === 'string' ? data.error : data.error.message ?? 'Unbekannter Fehler')
    }

    const raw: string = data?.content?.[0]?.text ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Konnte die Antwort der KI nicht als JSON lesen.')
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ParsedAppointment>
    if (!parsed.title || !parsed.date) {
      throw new Error('Die KI konnte keinen vollständigen Termin erkennen.')
    }

    return {
      title: parsed.title,
      description: parsed.description ?? null,
      date: parsed.date,
      endDate: parsed.endDate ?? null,
      startTime: parsed.startTime ?? null,
      endTime: parsed.endTime ?? null,
      colleagueIds: Array.isArray(parsed.colleagueIds) ? parsed.colleagueIds : [],
    }
  },

  checkAvailability: async (userIds, date, endDate, startTime, endTime) => {
    if (userIds.length === 0) return []

    const { data, error } = await supabase.rpc('check_colleague_availability', {
      p_user_ids: userIds,
      p_date: date,
      p_end_date: endDate,
      p_start_time: startTime,
      p_end_time: endTime,
    })

    if (error) throw new Error(error.message)

    return ((data ?? []) as AvailabilityRow[]).map((row) => ({
      userId: row.user_id,
      busy: row.busy,
      conflictTitle: row.conflict_title,
    }))
  },
}))
