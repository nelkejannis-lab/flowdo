import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Image, Mic, MicOff, Send, Sparkles, X, Calendar, CheckSquare, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCalendarEntriesStore } from '../../store/calendarEntriesStore'
import { useTasksStore } from '../../store/tasksStore'
import { useBoardsStore } from '../../store/boardsStore'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface Action {
  type: string
  label: string
  payload: Record<string, unknown>
  status?: 'pending' | 'done' | 'error'
  editTitle?: string
  editDate?: string
  editPriority?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  actions?: Action[]
  awaitingConfirm?: boolean
}

const TODAY = format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })

const SYSTEM_PROMPT = `Du bist ein KI-Assistent für die App Mooncrew – ein Arbeits-Organizer mit Kalender, Aufgaben und Projekten.
Heute ist ${TODAY} (${format(new Date(), 'yyyy-MM-dd')}).

Antworte AUSSCHLIESSLICH mit gültigem JSON in exakt diesem Format – nichts davor oder danach:

{
  "message": "Kurze freundliche Bestätigung auf Deutsch",
  "actions": [ ...alle erkannten Aktionen... ]
}

Mögliche Action-Typen:

Aufgabe erstellen:
{ "type": "create_task", "label": "Aufgabe: TITEL", "payload": { "title": "string", "dueDate": "yyyy-MM-dd oder null", "priority": "low|medium|high", "description": "string oder null" }}

Termin erstellen:
{ "type": "create_event", "label": "Termin: TITEL", "payload": { "title": "string", "date": "yyyy-MM-dd", "endDate": "yyyy-MM-dd oder null", "startTime": "HH:MM oder null", "endTime": "HH:MM oder null", "description": "string oder null" }}

Projekt erstellen:
{ "type": "create_board", "label": "Projekt: TITEL", "payload": { "title": "string", "description": "string oder null", "color": "#6366f1" }}

Navigieren:
{ "type": "navigate", "label": "Öffne SEITE", "payload": { "path": "/dashboard|/tasks|/calendar|/boards|/pomodoro|/ai-scheduler|/chat|/friends|/worktime|/eisenhower|/settings" }}

WICHTIGE REGELN:
- Bei Screenshots oder Fotos von Aufgabenlisten, Kalendern, Tabellen oder To-Do-Listen: Extrahiere JEDEN erkennbaren Eintrag als eigene Action. Lasse nichts aus.
- Datumsspalten wie "19. Jun", "26. Jun" → aktuelles Jahr verwenden → "2025-06-19", "2025-06-26"
- Datumsbereiche wie "10. Aug - 1. Sep" → date: "2025-08-10", endDate: "2025-09-01"
- Wenn ein Eintrag einen festen Termin hat → create_event, sonst → create_task mit dueDate
- Bei vielen Einträgen (10+): alle trotzdem vollständig extrahieren
- Wenn kein Jahr erkennbar ist: aktuelles Jahr (2025) annehmen
- Antworte NUR mit JSON, kein Markdown, keine Erklärungen außerhalb des JSON`

export default function AiChatPanel() {
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

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: '',
        actions: [],
      }])
      setMessages([{
        role: 'assistant',
        content: `Hallo! Ich bin dein KI-Assistent für Mooncrew. Ich kann die App für dich steuern:\n\n• Aufgaben & Termine erstellen\n• Projekte anlegen\n• Zu Seiten navigieren\n• Bilder auslesen 📸\n• Spracheingabe 🎙️\n\nWas soll ich für dich tun?`,
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
    if (!SR) { alert('Spracheingabe wird in diesem Browser nicht unterstützt.'); return }
    const rec = new SR()
    rec.lang = 'de-DE'
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
    // Use edited values if available
    const title = action.editTitle ?? action.payload.title as string
    const date = action.editDate ?? action.payload.date as string ?? action.payload.dueDate as string
    const priority = (action.editPriority ?? action.payload.priority as string ?? 'medium') as 'low' | 'medium' | 'high'
    const p = action.payload

    try {
      if (action.type === 'create_task') {
        if (!title) return { status: 'error', error: 'Kein Titel' }
        await addTask({
          title,
          dueDate: date || undefined,
          priority,
          description: (p.description as string) || undefined,
          tags: [],
          evening: false,
        })
        return { status: 'done' }
      }
      if (action.type === 'create_event') {
        if (!title) return { status: 'error', error: 'Kein Titel' }
        if (!date) return { status: 'error', error: 'Kein Datum' }
        const errMsg = await addEntry({
          type: 'termin',
          title,
          date,
          endDate: (p.endDate as string) || undefined,
          startTime: (p.startTime as string) || undefined,
          endTime: (p.endTime as string) || undefined,
          description: (p.description as string) || undefined,
          color: '#10B981',
          invitedUserIds: [],
        })
        if (errMsg) return { status: 'error', error: errMsg }
        return { status: 'done' }
      }
      if (action.type === 'create_board') {
        if (!title) return { status: 'error', error: 'Kein Titel' }
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
      updatedActions[i] = { ...updatedActions[i], status: result.status }
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

  function updateActionEdit(msgIdx: number, actionIdx: number, field: 'editTitle' | 'editDate' | 'editPriority', value: string) {
    setMessages((prev) => {
      const next = [...prev]
      const actions = [...(next[msgIdx].actions ?? [])]
      actions[actionIdx] = { ...actions[actionIdx], [field]: value }
      next[msgIdx] = { ...next[msgIdx], actions }
      return next
    })
  }

  async function send() {
    const text = input.trim()
    if (!text && !pendingImage) return

    const userMsg: Message = {
      role: 'user',
      content: text || '(Bild)',
      imageUrl: pendingImage?.url,
    }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    const imgToSend = pendingImage
    setPendingImage(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          systemPrompt: SYSTEM_PROMPT,
          imageBase64: imgToSend?.base64 ?? null,
          imageMimeType: imgToSend?.mimeType ?? null,
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
        content: `Fehler: ${err instanceof Error ? err.message : String(err)}`,
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
    create_event: <Calendar size={11} />,
    create_board: <ArrowRight size={11} />,
    navigate: <ArrowRight size={11} />,
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
        title="KI-Assistent"
      >
        {open
          ? <X size={22} className="text-white" />
          : <Bot size={24} className="text-white" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-20 right-3 z-40 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-racing-700 dark:bg-racing-900 sm:bottom-24 sm:right-6"
          style={{ width: 'min(420px, calc(100vw - 12px))', height: 'min(600px, calc(100dvh - 90px))' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 bg-accent px-4 py-3">
            <Sparkles size={17} className="text-white" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Mooncrew Assistent</p>
              <p className="text-[11px] text-white/70">Text · Bild · Sprache · App-Steuerung</p>
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
                        Soll ich das ausführen?
                      </p>
                      <div className="space-y-2">
                        {m.actions.map((a, j) => (
                          <div key={j} className="flex flex-col gap-1 rounded-lg bg-white p-2 shadow-sm dark:bg-racing-800">
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-600 dark:text-amber-400">{iconFor[a.type] ?? <CheckSquare size={11} />}</span>
                              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{a.type.replace('_', ' ')}</span>
                            </div>
                            <input
                              className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-racing-600 dark:bg-racing-700 dark:text-racing-100"
                              value={a.editTitle ?? ''}
                              onChange={(e) => updateActionEdit(i, j, 'editTitle', e.target.value)}
                              placeholder="Titel"
                            />
                            {(a.type === 'create_task' || a.type === 'create_event') && (
                              <div className="flex gap-1.5">
                                <input
                                  className="flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-racing-600 dark:bg-racing-700 dark:text-racing-100"
                                  type="date"
                                  value={a.editDate ?? ''}
                                  onChange={(e) => updateActionEdit(i, j, 'editDate', e.target.value)}
                                />
                                {a.type === 'create_task' && (
                                  <select
                                    className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-racing-600 dark:bg-racing-700 dark:text-racing-100"
                                    value={a.editPriority ?? 'medium'}
                                    onChange={(e) => updateActionEdit(i, j, 'editPriority', e.target.value)}
                                  >
                                    <option value="low">Niedrig</option>
                                    <option value="medium">Mittel</option>
                                    <option value="high">Hoch</option>
                                  </select>
                                )}
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
                          Alle ausführen ({m.actions.length})
                        </button>
                        <button
                          onClick={() => declineActions(i)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-racing-600 dark:text-racing-300"
                        >
                          Ablehnen
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
                        Erstelle {progress.done} / {progress.total}…
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
                placeholder={'Frag mich alles… z.B. "Erstelle eine Aufgabe für morgen"'}
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
                <button onClick={() => fileRef.current?.click()} title="Bild hochladen"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-racing-800 dark:text-racing-300">
                  <Image size={15} />
                </button>
                <button onClick={listening ? stopVoice : startVoice} title={listening ? 'Stop' : 'Sprache'}
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
