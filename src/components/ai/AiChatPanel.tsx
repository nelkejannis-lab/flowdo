import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bot, Image, Mic, MicOff, Send, Sparkles, X, Calendar, CheckSquare, ArrowRight, Users } from 'lucide-react'
import BadgeChip from '../ui/BadgeChip'
import { supabase } from '../../lib/supabase'
import { useCalendarEntriesStore } from '../../store/calendarEntriesStore'
import { useTasksStore } from '../../store/tasksStore'
import { useBoardsStore } from '../../store/boardsStore'
import { useFriendsStore } from '../../store/friendsStore'
import { format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import type { Task } from '../../types'

interface Action {
  type: string
  label: string
  payload: Record<string, unknown>
  status?: 'pending' | 'done' | 'error'
  editTitle?: string
  editDate?: string
  editPriority?: string
  editStartTime?: string
  editEndTime?: string
  editDescription?: string
  editInvitees?: string[] // user IDs
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  actions?: Action[]
  awaitingConfirm?: boolean
}

function buildSystemPrompt(friendsList: { id: string; name: string }[], tasksList: Task[] | undefined, language: string) {
  const yr = new Date().getFullYear()
  const today = format(new Date(), 'EEEE, d. MMMM yyyy', { locale: language === 'en' ? enUS : de })

  if (language === 'en') {
    const friendsBlock = friendsList.length > 0
      ? `\nKnown people (for event invitations):\n${friendsList.map((f) => `- "${f.name}" → id: "${f.id}"`).join('\n')}\nIf the user invites a person, add their ID to invitedUserIds.`
      : ''
    const tasksBlock = tasksList && tasksList.length > 0
      ? `\nExisting tasks:\n${tasksList.map((t) => `- "${t.title}"${t.completed ? ' (done)' : ' (open)'}`).join('\n')}\nUse this list to determine the exact title for complete_task, delete_task, or update_task.`
      : ''
    return `You are an AI assistant for the NOVAT app – a work organizer with calendar, tasks, and projects.
Today is ${today} (${format(new Date(), 'yyyy-MM-dd')}).${friendsBlock}${tasksBlock}

Respond EXCLUSIVELY with valid JSON in exactly this format – nothing before or after:

{
  "message": "Short friendly confirmation in English",
  "actions": [ ...all recognized actions... ]
}

Possible action types:

Create task:
{ "type": "create_task", "label": "Create task: TITLE", "payload": { "title": "string", "dueDate": "yyyy-MM-dd or null", "priority": "low|medium|high", "description": "string or null" }}

Mark task as done:
{ "type": "complete_task", "label": "Complete task: EXACT_TITLE", "payload": { "title": "string" }}

Delete task:
{ "type": "delete_task", "label": "Delete task: EXACT_TITLE", "payload": { "title": "string" }}

Update task (fields optional, only give changed ones):
{ "type": "update_task", "label": "Update task: EXACT_TITLE", "payload": { "title": "string", "newTitle": "string or null", "dueDate": "yyyy-MM-dd or null", "priority": "low|medium|high or null", "evening": "boolean or null", "someday": "boolean or null", "description": "string or null", "recurrence": "daily|weekly|monthly or null" }}

Create appointment:
{ "type": "create_event", "label": "Appointment: TITLE", "payload": { "title": "string", "date": "yyyy-MM-dd", "endDate": "yyyy-MM-dd or null", "startTime": "HH:MM or null", "endTime": "HH:MM or null", "description": "string or null", "invitedUserIds": ["user-id-1", ...] }}

Create project:
{ "type": "create_board", "label": "Project: TITLE", "payload": { "title": "string", "description": "string or null", "color": "#6366f1" }}

Navigate:
{ "type": "navigate", "label": "Open PAGE", "payload": { "path": "/dashboard|/tasks|/calendar|/boards|/ai-scheduler|/chat|/friends|/worktime|/eisenhower|/settings" }}

IMPORTANT RULES:
- For screenshots or photos of task lists, calendars, tables, or to-do lists: extract EVERY recognizable entry as its own action. Leave nothing out.
- Date columns like "Jun 19", "Jun 26" → use the current year → "${yr}-06-19", "${yr}-06-26"
- Date ranges like "Aug 10 - Sep 1" → date: "${yr}-08-10", endDate: "${yr}-09-01"
- If an entry has a fixed time → create_event, otherwise → create_task with dueDate
- For many entries (10+): still extract all of them completely
- If no year is recognizable: assume the current year (${yr})
- Respond ONLY with JSON, no markdown, no explanations outside the JSON`
  }

  const friendsBlock = friendsList.length > 0
    ? `\nBekannte Personen (für Termin-Einladungen):\n${friendsList.map((f) => `- "${f.name}" → id: "${f.id}"`).join('\n')}\nWenn der Nutzer eine Person einlädt, füge ihre ID in invitedUserIds ein.`
    : ''
  const tasksBlock = tasksList && tasksList.length > 0
    ? `\nVorhandene Aufgaben:\n${tasksList.map((t) => `- "${t.title}"${t.completed ? ' (erledigt)' : ' (offen)'}`).join('\n')}\nVerwende diese Liste, um den genauen Titel bei complete_task, delete_task oder update_task zu ermitteln.`
    : ''
  return `Du bist ein KI-Assistent für die App NOVAT – ein Arbeits-Organizer mit Kalender, Aufgaben und Projekten.
Heute ist ${today} (${format(new Date(), 'yyyy-MM-dd')}).${friendsBlock}${tasksBlock}

Antworte AUSSCHLIESSLICH mit gültigem JSON in exakt diesem Format – nichts davor oder danach:

{
  "message": "Kurze freundliche Bestätigung auf Deutsch",
  "actions": [ ...alle erkannten Aktionen... ]
}

Mögliche Action-Typen:

Aufgabe erstellen:
{ "type": "create_task", "label": "Aufgabe erstellen: TITEL", "payload": { "title": "string", "dueDate": "yyyy-MM-dd oder null", "priority": "low|medium|high", "description": "string oder null" }}

Aufgabe als erledigt markieren:
{ "type": "complete_task", "label": "Aufgabe erledigen: GENAUER_TITEL", "payload": { "title": "string" }}

Aufgabe löschen:
{ "type": "delete_task", "label": "Aufgabe löschen: GENAUER_TITEL", "payload": { "title": "string" }}

Aufgabe aktualisieren (Felder optional, nur geänderte angeben):
{ "type": "update_task", "label": "Aufgabe aktualisieren: GENAUER_TITEL", "payload": { "title": "string", "newTitle": "string oder null", "dueDate": "yyyy-MM-dd oder null", "priority": "low|medium|high oder null", "evening": "boolean oder null", "someday": "boolean oder null", "description": "string oder null", "recurrence": "daily|weekly|monthly oder null" }}

Termin erstellen:
{ "type": "create_event", "label": "Termin: TITEL", "payload": { "title": "string", "date": "yyyy-MM-dd", "endDate": "yyyy-MM-dd oder null", "startTime": "HH:MM oder null", "endTime": "HH:MM oder null", "description": "string oder null", "invitedUserIds": ["user-id-1", ...] }}

Projekt erstellen:
{ "type": "create_board", "label": "Projekt: TITEL", "payload": { "title": "string", "description": "string oder null", "color": "#6366f1" }}

Navigieren:
{ "type": "navigate", "label": "Öffne SEITE", "payload": { "path": "/dashboard|/tasks|/calendar|/boards|/ai-scheduler|/chat|/friends|/worktime|/eisenhower|/settings" }}

WICHTIGE REGELN:
- Bei Screenshots oder Fotos von Aufgabenlisten, Kalendern, Tabellen oder To-Do-Listen: Extrahiere JEDEN erkennbaren Eintrag als eigene Action. Lasse nichts aus.
- Datumsspalten wie "19. Jun", "26. Jun" → aktuelles Jahr verwenden → "${yr}-06-19", "${yr}-06-26"
- Datumsbereiche wie "10. Aug - 1. Sep" → date: "${yr}-08-10", endDate: "${yr}-09-01"
- Wenn ein Eintrag einen festen Termin hat → create_event, sonst → create_task mit dueDate
- Bei vielen Einträgen (10+): alle trotzdem vollständig extrahieren
- Wenn kein Jahr erkennbar ist: aktuelles Jahr (${yr}) annehmen
- Antworte NUR mit JSON, kein Markdown, keine Erklärungen außerhalb des JSON`
}

export default function AiChatPanel() {
  const { t, i18n } = useTranslation('aiChat')
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; url: string } | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [confirmingMsgIdx, setConfirmingMsgIdx] = useState<number | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const navigate = useNavigate()
  const addEntry = useCalendarEntriesStore((s) => s.addEntry)
  const addTask = useTasksStore((s) => s.addTask)
  const addBoard = useBoardsStore((s) => s.addBoard)
  const friends = useFriendsStore((s) => s.friends)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)

  useEffect(() => { fetchFriends() }, [])

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: '',
        actions: [],
      }])
      setMessages([{
        role: 'assistant',
        content: t('greeting'),
      }])
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setPendingImage({ base64: result.split(',')[1], mimeType: file.type, url: result })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert(t('voiceNotSupported')); return }
    const rec = new SR()
    rec.lang = i18n.language === 'en' ? 'en-US' : 'de-DE'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput((prev) => prev ? prev + ' ' + transcript : transcript)
      textareaRef.current?.focus()
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  function stopVoice() { recognitionRef.current?.stop(); setListening(false) }

  async function executeAction(action: Action): Promise<{ status: 'done' | 'error'; error?: string }> {
    const title = (action.editTitle || (action.payload.title as string)) || ''
    const date = (action.editDate || (action.payload.date as string) || (action.payload.dueDate as string)) || ''
    const priority = (action.editPriority ?? action.payload.priority as string ?? 'medium') as 'low' | 'medium' | 'high'
    const startTime = (action.editStartTime || (action.payload.startTime as string)) || undefined
    const endTime = (action.editEndTime || (action.payload.endTime as string)) || undefined
    const description = (action.editDescription || (action.payload.description as string)) || undefined
    const invitedUserIds = action.editInvitees ?? []
    const p = action.payload

    try {
      if (action.type === 'create_task') {
        if (!title) return { status: 'error', error: t('errors.noTitle') }
        await addTask({
          title,
          dueDate: date || undefined,
          priority,
          description,
          tags: [],
          evening: false,
        })
        return { status: 'done' }
      }
      if (action.type === 'complete_task') {
        if (!title) return { status: 'error', error: t('errors.noTitleGiven') }
        const tList = useTasksStore.getState().tasks
        let task = tList.find((t) => t.title.toLowerCase() === title.toLowerCase())
        if (!task) {
          task = tList.find((t) => t.title.toLowerCase().includes(title.toLowerCase()))
        }
        if (!task) return { status: 'error', error: t('errors.taskNotFound') }
        if (task.completed) return { status: 'done' }
        useTasksStore.getState().toggleTaskCompleted(task.id)
        return { status: 'done' }
      }
      if (action.type === 'delete_task') {
        if (!title) return { status: 'error', error: t('errors.noTitleGiven') }
        const tList = useTasksStore.getState().tasks
        let task = tList.find((t) => t.title.toLowerCase() === title.toLowerCase())
        if (!task) {
          task = tList.find((t) => t.title.toLowerCase().includes(title.toLowerCase()))
        }
        if (!task) return { status: 'error', error: t('errors.taskNotFound') }
        useTasksStore.getState().deleteTask(task.id)
        return { status: 'done' }
      }
      if (action.type === 'update_task') {
        if (!title) return { status: 'error', error: t('errors.noTitleGiven') }
        const tList = useTasksStore.getState().tasks
        let task = tList.find((t) => t.title.toLowerCase() === title.toLowerCase())
        if (!task) {
          task = tList.find((t) => t.title.toLowerCase().includes(title.toLowerCase()))
        }
        if (!task) return { status: 'error', error: t('errors.taskNotFound') }

        const updates: Partial<Task> = {}
        if (p.newTitle) updates.title = p.newTitle as string
        if (p.dueDate !== undefined) updates.dueDate = (p.dueDate as string) || undefined
        if (p.priority !== undefined) updates.priority = p.priority as any
        if (p.description !== undefined) updates.description = (p.description as string) || undefined
        if (p.evening !== undefined) updates.evening = p.evening as boolean
        if (p.someday !== undefined) updates.someday = p.someday as boolean
        if (p.recurrence !== undefined) updates.recurrence = (p.recurrence as any) || undefined

        useTasksStore.getState().updateTask(task.id, updates)
        return { status: 'done' }
      }
      if (action.type === 'create_event') {
        if (!title) return { status: 'error', error: t('errors.noTitle') }
        if (!date) return { status: 'error', error: t('errors.noDate') }
        const errMsg = await addEntry({
          type: 'termin',
          title,
          date,
          endDate: (p.endDate as string) || undefined,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          description,
          color: '#10B981',
          invitedUserIds,
        })
        if (errMsg) return { status: 'error', error: errMsg }
        return { status: 'done' }
      }
      if (action.type === 'create_board') {
        if (!title) return { status: 'error', error: t('errors.noTitle') }
        await addBoard({
          title,
          description: (p.description as string) || undefined,
          color: (p.color as string) ?? '#6366f1',
        })
        return { status: 'done' }
      }
      if (action.type === 'navigate') {
        navigate(p.path as string)
        return { status: 'done' }
      }
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : String(err) }
    }
    return { status: 'done' }
  }

  async function confirmActions(msgIdx: number) {
    const msg = messages[msgIdx]
    if (!msg?.actions?.length) return
    setConfirmingMsgIdx(null)
    setProgress({ done: 0, total: msg.actions.length })

    const updatedActions = [...msg.actions]
    for (let i = 0; i < updatedActions.length; i++) {
      const result = await executeAction(updatedActions[i])
      updatedActions[i] = { ...updatedActions[i], status: result.status, ...(result.error ? { errorMsg: result.error } : {}) } as Action & { errorMsg?: string }
      setMessages((prev) => {
        const next = [...prev]
        next[msgIdx] = { ...next[msgIdx], actions: [...updatedActions], awaitingConfirm: false }
        return next
      })
      setProgress({ done: i + 1, total: updatedActions.length })
    }
    setProgress(null)
  }

  function declineActions(msgIdx: number) {
    setConfirmingMsgIdx(null)
    setMessages((prev) => {
      const next = [...prev]
      next[msgIdx] = {
        ...next[msgIdx],
        awaitingConfirm: false,
        actions: (next[msgIdx].actions ?? []).map((a) => ({ ...a, status: 'error' as const })),
      }
      return next
    })
  }

  function updateActionEdit(msgIdx: number, actionIdx: number, field: 'editTitle' | 'editDate' | 'editPriority' | 'editStartTime' | 'editEndTime' | 'editDescription', value: string) {
    setMessages((prev) => {
      const next = [...prev]
      const actions = [...(next[msgIdx].actions ?? [])]
      actions[actionIdx] = { ...actions[actionIdx], [field]: value }
      next[msgIdx] = { ...next[msgIdx], actions }
      return next
    })
  }

  function toggleInvitee(msgIdx: number, actionIdx: number, userId: string) {
    setMessages((prev) => {
      const next = [...prev]
      const actions = [...(next[msgIdx].actions ?? [])]
      const current = actions[actionIdx].editInvitees ?? []
      actions[actionIdx] = {
        ...actions[actionIdx],
        editInvitees: current.includes(userId)
          ? current.filter((id) => id !== userId)
          : [...current, userId],
      }
      next[msgIdx] = { ...next[msgIdx], actions }
      return next
    })
  }

  async function send() {
    const text = input.trim()
    if (!text && !pendingImage) return

    const userMsg: Message = {
      role: 'user',
      content: text || t('imageMessagePlaceholder'),
      imageUrl: pendingImage?.url,
    }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    const imgToSend = pendingImage
    setPendingImage(null)
    setLoading(true)

    try {
      const friendsList = friends.map((f) => ({
        id: f.profile.id,
        name: f.profile.display_name ?? f.profile.username ?? f.profile.id,
      }))
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          systemPrompt: buildSystemPrompt(friendsList, useTasksStore.getState().tasks, i18n.language),
          imageBase64: imgToSend?.base64 ?? null,
          imageMimeType: imgToSend?.mimeType ?? null,
          model: 'claude-haiku-4-5-20251001',
          maxTokens: 2048,
        },
      })
      if (error) throw new Error(error.message)

      const raw: string = data?.text ?? '{}'
      let parsed: { message: string; actions: Action[] } = { message: raw, actions: [] }
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
      } catch { /* keep raw as message */ }

      const actionsWithEdits: Action[] = (parsed.actions ?? []).map((a) => ({
        ...a,
        status: 'pending' as const,
        editTitle: (a.payload.title ?? a.payload.path ?? '') as string,
        editDate: (a.payload.date ?? a.payload.dueDate ?? '') as string,
        editPriority: (a.payload.priority ?? 'medium') as string,
        editStartTime: (a.payload.startTime ?? '') as string,
        editEndTime: (a.payload.endTime ?? '') as string,
        editDescription: (a.payload.description ?? '') as string,
        editInvitees: (a.payload.invitedUserIds as string[] | undefined) ?? [],
      }))

      const assistantMsg: Message = {
        role: 'assistant',
        content: parsed.message ?? raw,
        actions: actionsWithEdits,
        awaitingConfirm: actionsWithEdits.length > 0,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: t('errorPrefix', { message: err instanceof Error ? err.message : String(err) }),
      }])
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const iconFor: Record<string, React.ReactNode> = {
    create_task: <CheckSquare size={11} />,
    complete_task: <CheckSquare size={11} className="text-emerald-500" />,
    delete_task: <X size={11} className="text-red-500" />,
    update_task: <ArrowRight size={11} className="text-blue-500" />,
    create_event: <Calendar size={11} />,
    create_board: <ArrowRight size={11} />,
    navigate: <ArrowRight size={11} />,
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 sm:bottom-6 sm:right-6"
        title={t('assistantTitle')}
      >
        {open
          ? <X size={22} className="text-white" />
          : <Bot size={24} className="text-white" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-24 right-3 z-40 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-racing-700 dark:bg-racing-900 sm:bottom-24 sm:right-6"
          style={{ width: 'min(420px, calc(100vw - 12px))', height: 'min(600px, calc(100dvh - 90px))' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 bg-accent px-4 py-3">
            <Sparkles size={17} className="text-white" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{t('panelTitle')}</p>
              <p className="text-[11px] text-white/70">{t('panelSubtitle')}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 px-3 py-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] space-y-1.5 ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  {m.imageUrl && (
                    <img src={m.imageUrl} alt="" className="max-h-36 w-full rounded-xl object-cover" />
                  )}
                  {m.content && (
                    <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'rounded-tr-sm bg-accent text-white'
                        : 'rounded-tl-sm bg-gray-100 text-gray-800 dark:bg-racing-800 dark:text-racing-100'
                    }`}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  )}
                  {/* Action confirmation UI */}
                  {m.actions && m.actions.length > 0 && m.awaitingConfirm && (
                    <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                      <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        {t('confirmPrompt')}
                      </p>
                      <div className="space-y-2">
                        {m.actions.map((a, j) => (
                          <div key={j} className="flex flex-col gap-1.5 rounded-lg bg-white p-2.5 shadow-sm dark:bg-racing-800">
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-600 dark:text-amber-400">{iconFor[a.type] ?? <CheckSquare size={11} />}</span>
                              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                                {t(`actionTypes.${a.type}`, { defaultValue: t('actionTypes.navigate') })}
                              </span>
                            </div>
                            {/* Title */}
                            <input
                              className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-racing-600 dark:bg-racing-700 dark:text-racing-100"
                              value={a.editTitle ?? ''}
                              onChange={(e) => updateActionEdit(i, j, 'editTitle', e.target.value)}
                              placeholder={t('titlePlaceholder')}
                            />
                            {/* Date row */}
                            {(a.type === 'create_task' || a.type === 'create_event' || a.type === 'update_task') && (
                              <div className="flex gap-1.5 flex-wrap">
                                <input
                                  className="flex-1 min-w-[100px] rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-racing-600 dark:bg-racing-700 dark:text-racing-100"
                                  type="date"
                                  value={a.editDate ?? ''}
                                  onChange={(e) => updateActionEdit(i, j, 'editDate', e.target.value)}
                                />
                                {(a.type === 'create_task' || a.type === 'update_task') && (
                                  <select
                                    className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-racing-600 dark:bg-racing-700 dark:text-racing-100"
                                    value={a.editPriority ?? 'medium'}
                                    onChange={(e) => updateActionEdit(i, j, 'editPriority', e.target.value)}
                                  >
                                    <option value="low">{t('priority.low')}</option>
                                    <option value="medium">{t('priority.medium')}</option>
                                    <option value="high">{t('priority.high')}</option>
                                  </select>
                                )}
                              </div>
                            )}
                            {/* Time row for events */}
                            {a.type === 'create_event' && (
                              <div className="flex gap-1.5 items-center">
                                <span className="text-[10px] text-gray-400">{t('from')}</span>
                                <input
                                  type="time"
                                  className="flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-racing-600 dark:bg-racing-700 dark:text-racing-100"
                                  value={a.editStartTime ?? ''}
                                  onChange={(e) => updateActionEdit(i, j, 'editStartTime', e.target.value)}
                                />
                                <span className="text-[10px] text-gray-400">{t('to')}</span>
                                <input
                                  type="time"
                                  className="flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-racing-600 dark:bg-racing-700 dark:text-racing-100"
                                  value={a.editEndTime ?? ''}
                                  onChange={(e) => updateActionEdit(i, j, 'editEndTime', e.target.value)}
                                />
                              </div>
                            )}
                            {/* Description */}
                            {(a.type === 'create_task' || a.type === 'create_event' || a.type === 'update_task') && (
                              <input
                                className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-racing-600 dark:bg-racing-700 dark:text-racing-100"
                                value={a.editDescription ?? ''}
                                onChange={(e) => updateActionEdit(i, j, 'editDescription', e.target.value)}
                                placeholder={t('descriptionPlaceholder')}
                              />
                            )}
                            {/* Invitees for events */}
                            {a.type === 'create_event' && friends.length > 0 && (
                              <div>
                                <p className="mb-1 flex items-center gap-1 text-[10px] font-medium text-gray-400">
                                  <Users size={10} /> {t('inviteLabel')}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {friends.map((f) => {
                                    const selected = (a.editInvitees ?? []).includes(f.profile.id)
                                    return (
                                      <button
                                        key={f.profile.id}
                                        onClick={() => toggleInvitee(i, j, f.profile.id)}
                                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                                          selected
                                            ? 'bg-accent text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-racing-700 dark:text-racing-200'
                                        }`}
                                      >
                                        {f.profile.avatar_url
                                          ? <img src={f.profile.avatar_url} className="h-3.5 w-3.5 rounded-full" alt="" />
                                          : <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-current/20 text-[8px]">{(f.profile.display_name ?? '?')[0]}</span>
                                        }
                                        {f.profile.display_name ?? f.profile.username}
                                        {f.profile.badge && <BadgeChip badge={f.profile.badge} size="xs" />}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2.5 flex gap-2">
                        <button
                          onClick={() => confirmActions(i)}
                          className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                        >
                          {t('executeAll', { count: m.actions.length })}
                        </button>
                        <button
                          onClick={() => declineActions(i)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-racing-600 dark:text-racing-300"
                        >
                          {t('decline')}
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Executed action chips */}
                  {m.actions && m.actions.length > 0 && !m.awaitingConfirm && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.actions.map((a, j) => (
                        <span
                          key={j}
                          title={(a as any).errorMsg ?? undefined}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                            a.status === 'done'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : a.status === 'error'
                              ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {a.status === 'done' ? '✓' : a.status === 'error' ? '✗' : (iconFor[a.type] ?? <CheckSquare size={11} />)}
                          {a.label}
                          {a.status === 'error' && (a as any).errorMsg && (
                            <span className="ml-1 opacity-70">— {(a as any).errorMsg}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {(loading || progress) && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 dark:bg-racing-800">
                  {progress ? (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-600 dark:text-racing-300">
                        {t('creatingProgress', { done: progress.done, total: progress.total })}
                      </p>
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-gray-200 dark:bg-racing-700">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-300"
                          style={{ width: `${(progress.done / progress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {[0, 150, 300].map((d) => (
                        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Image preview */}
          {pendingImage && (
            <div className="relative mx-3 mb-1 inline-block">
              <img src={pendingImage.url} alt="" className="h-14 w-14 rounded-lg object-cover" />
              <button onClick={() => setPendingImage(null)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white">
                <X size={10} />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-100 px-3 py-2.5 dark:border-racing-700">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('inputPlaceholder')}
                rows={2}
                className="flex-1 resize-none rounded-xl bg-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 dark:bg-racing-800 dark:text-racing-100"
                style={{ minHeight: 52, maxHeight: 120 }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 120) + 'px'
                }}
              />
              <div className="flex flex-col gap-1.5">
                <button onClick={() => fileRef.current?.click()} title={t('uploadImageTitle')}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-racing-800 dark:text-racing-300">
                  <Image size={15} />
                </button>
                <button onClick={listening ? stopVoice : startVoice} title={listening ? t('voiceStop') : t('voiceStart')}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${listening ? 'animate-pulse bg-red-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-racing-800 dark:text-racing-300'}`}>
                  {listening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                <button onClick={send} disabled={loading || (!input.trim() && !pendingImage)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40">
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
    </>
  )
}
