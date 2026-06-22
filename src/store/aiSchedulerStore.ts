import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import type { ParsedTaskInput } from '../utils/date'

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

export interface BusySlot {
  userId: string
  userName: string
  title: string
  date: string
  endDate?: string
  startTime?: string
  endTime?: string
}

export interface BestSlotResult {
  date: string
  startTime: string
  endTime: string
  explanation: string
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
  getBusySlots: (
    userIds: string[],
    fromDate: string,
    toDate: string,
    colleagues: { id: string; name: string }[]
  ) => Promise<BusySlot[]>
  findBestSlot: (
    colleagues: { id: string; name: string }[],
    busySlots: BusySlot[],
    fromDate: string,
    toDate: string,
    durationMinutes: number,
    preferredStartTime: string | null,
    preferredEndTime: string | null
  ) => Promise<BestSlotResult>
  parseTaskWithAi: (
    text: string,
    boards: { id: string; title: string }[]
  ) => Promise<ParsedTaskInput>
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

  getBusySlots: async (userIds, fromDate, toDate, colleagues) => {
    if (userIds.length === 0) return []

    const { data, error } = await supabase.rpc('get_colleague_busy_slots', {
      p_user_ids: userIds,
      p_from_date: fromDate,
      p_to_date: toDate,
    })

    if (error) throw new Error(error.message)

    return ((data ?? []) as Array<{
      user_id: string
      title: string
      date: string
      end_date: string | null
      start_time: string | null
      end_time: string | null
    }>).map((row) => ({
      userId: row.user_id,
      userName: colleagues.find((c) => c.id === row.user_id)?.name ?? row.user_id,
      title: row.title,
      date: row.date,
      endDate: row.end_date ?? undefined,
      startTime: row.start_time ?? undefined,
      endTime: row.end_time ?? undefined,
    }))
  },

  findBestSlot: async (colleagues, busySlots, fromDate, toDate, durationMinutes, preferredStartTime, preferredEndTime) => {
    const { data, error } = await supabase.functions.invoke('ai-scheduler', {
      body: {
        action: 'find-best-slot',
        colleagues,
        busySlots,
        fromDate,
        toDate,
        durationMinutes,
        preferredStartTime,
        preferredEndTime,
      },
    })

    if (error) throw new Error(error.message ?? 'Anfrage fehlgeschlagen')
    if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : data.error.message ?? 'Unbekannter Fehler')

    const raw: string = data?.content?.[0]?.text ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('KI-Antwort konnte nicht gelesen werden.')

    const parsed = JSON.parse(jsonMatch[0]) as Partial<BestSlotResult>
    if (!parsed.date || !parsed.startTime || !parsed.endTime) throw new Error('KI konnte keinen passenden Termin finden.')

    return parsed as BestSlotResult
  },

  parseTaskWithAi: async (text, boards) => {
    const today = new Date()
    const todayIso = format(today, 'yyyy-MM-dd')
    const weekday = format(today, 'EEEE', { locale: de })

    const boardsList = boards.length > 0
      ? boards.map((b) => `- "${b.title}" (id: ${b.id})`).join('\n')
      : '(keine Projekte vorhanden)'

    const systemPrompt = `Du wandelst eine deutsche Aufgabenbeschreibung (To-Do/Task) in JSON um.
Heutiges Datum: ${todayIso} (${weekday}).
Verfügbare Projekte (Boards):
${boardsList}

Antworte AUSSCHLIESSLICH mit kompaktem JSON ohne weiteren Text oder Erklärungen, in genau diesem Format:
{
  "title": "bereinigter Titel der Aufgabe",
  "dueDate": "yyyy-MM-dd" oder null,
  "projectId": "id-des-am-besten-passenden-projekts" oder null,
  "priority": "low" | "medium" | "high",
  "urgent": boolean,
  "important": boolean
}

Regeln:
- Der Titel soll kurz und prägnant sein und keine Füllwörter wie "erstelle eine aufgabe", "ich muss", "in 2 wochen", "in Projekt X" enthalten (z. B. "ideen Tom kalender").
- Löse relative Datumsangaben ("heute", "morgen", "in 2 wochen", "nächsten Dienstag") anhand des heutigen Datums auf. "in 2 wochen" ist genau 14 Tage nach heute.
- Finde ein passendes Projekt aus der obigen Liste (z.B. wenn im Text "bei Febi" steht und ein Projekt "Febi" existiert, ordne dieses zu).
- Setze die Priorität, dringend und wichtig basierend auf Ausdrücken wie "dringend", "wichtig", "sehr wichtig", "prio hoch".`

    const { data, error } = await supabase.functions.invoke('ai-scheduler', {
      body: { text, systemPrompt },
    })

    if (error || data?.error) {
      throw new Error(error?.message || data?.error || 'KI-Verbindung fehlgeschlagen')
    }

    const raw: string = data?.content?.[0]?.text ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Konnte die Antwort der KI nicht als JSON lesen.')
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ParsedTaskInput>
    return {
      title: parsed.title || text,
      dueDate: parsed.dueDate || undefined,
      projectId: parsed.projectId || undefined,
      priority: parsed.priority || 'medium',
      urgent: parsed.urgent || false,
      important: parsed.important || false,
    }
  },
}))
