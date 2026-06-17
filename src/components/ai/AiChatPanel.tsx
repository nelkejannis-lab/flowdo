import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Image, Mic, MicOff, Send, Sparkles, X, Calendar, CheckSquare, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCalendarEntriesStore } from '../../store/calendarEntriesStore'
import { useTasksStore } from '../../store/tasksStore'
import { useBoardsStore } from '../../store/boardsStore'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface Message {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  actions?: Action[]
}

interface Action {
  type: string
  label: string
  payload: Record<string, unknown>
  done?: boolean
}

const TODAY = format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })

const SYSTEM_PROMPT = `Du bist ein KI-Assistent für die App Mooncrew – ein Arbeits-Organizer mit Kalender, Aufgaben, Projekten (Boards) und mehr.
Heute ist ${TODAY}.

Du kannst die App vollständig per Text steuern. Erkenne aus der Nutzereingabe (auch Bilder oder Sprache) was der Nutzer möchte und antworte immer in diesem JSON-Format:

{
  "message": "Kurze freundliche Bestätigung auf Deutsch (1-2 Sätze)",
  "actions": [
    // EINER oder MEHRERE der folgenden Typen:

    // Aufgabe erstellen:
    { "type": "create_task", "label": "Aufgabe: [Titel]", "payload": {
      "title": "string",
      "dueDate": "yyyy-MM-dd oder null",
      "priority": "low|medium|high",
      "description": "string oder null"
    }},

    // Termin/Kalender-Eintrag erstellen:
    { "type": "create_event", "label": "Termin: [Titel]", "payload": {
      "title": "string",
      "date": "yyyy-MM-dd",
      "endDate": "yyyy-MM-dd oder null",
      "startTime": "HH:MM oder null",
      "endTime": "HH:MM oder null",
      "description": "string oder null"
    }},

    // Projekt/Board erstellen:
    { "type": "create_board", "label": "Projekt: [Titel]", "payload": {
      "title": "string",
      "description": "string oder null",
      "color": "#HEX-Farbe"
    }},

    // Seite navigieren:
    { "type": "navigate", "label": "Öffne [Seitenname]", "payload": {
      "path": "/dashboard | /tasks | /calendar | /boards | /pomodoro | /ai-scheduler | /chat | /friends | /worktime | /eisenhower | /settings"
    }}
  ]
}

Wenn du nichts tun kannst oder nur eine Frage beantwortest, setze "actions": [].
Antworte NUR mit gültigem JSON, nichts davor oder danach.
Nutze relative Datumsangaben korrekt (heute=${format(new Date(), 'yyyy-MM-dd')}).

Beispiele für Erkennungen:
- "Erinnere mich morgen ans Zahnarzt" → create_task mit morgen als dueDate
- "Meeting nächsten Dienstag 10 Uhr" → create_event
- "Gehe zu den Einstellungen" → navigate zu /settings
- "Erstelle ein Projekt namens Website-Relaunch" → create_board
- "Öffne den Kalender" → navigate zu /calendar`

export default function AiChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; url: string } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const navigate = useNavigate()
  const addEntry = useCalendarEntriesStore((s) => s.addEntry)
  const addTask = useTasksStore((s) => s.addTask)
  const createBoard = useBoardsStore((s) => s.createBoard)

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

  async function executeAction(action: Action): Promise<string> {
    const p = action.payload
    try {
      if (action.type === 'create_task') {
        await addTask({
          title: p.title as string,
          dueDate: (p.dueDate as string) ?? null,
          priority: (p.priority as 'low' | 'medium' | 'high') ?? 'medium',
          description: (p.description as string) ?? null,
          completed: false,
          tags: [],
          subtasks: [],
          evening: false,
        })
        return 'done'
      }
      if (action.type === 'create_event') {
        await addEntry({
          type: 'termin',
          title: p.title as string,
          date: p.date as string,
          endDate: (p.endDate as string) ?? null,
          startTime: (p.startTime as string) ?? null,
          endTime: (p.endTime as string) ?? null,
          description: (p.description as string) ?? null,
          color: '#10B981',
          allDay: !p.startTime,
        })
        return 'done'
      }
      if (action.type === 'create_board') {
        await createBoard({
          title: p.title as string,
          description: (p.description as string) ?? undefined,
          color: (p.color as string) ?? '#6366f1',
        })
        return 'done'
      }
      if (action.type === 'navigate') {
        navigate(p.path as string)
        return 'done'
      }
    } catch (err) {
      return 'error'
    }
    return 'done'
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

      const assistantMsg: Message = {
        role: 'assistant',
        content: parsed.message ?? raw,
        actions: parsed.actions ?? [],
      }
      setMessages((prev) => [...prev, assistantMsg])

      // Auto-execute all actions
      if (parsed.actions?.length) {
        for (const action of parsed.actions) {
          await executeAction(action)
        }
      }
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
          className="fixed bottom-24 right-6 z-40 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-racing-700 dark:bg-racing-900"
          style={{ width: 360, maxWidth: 'calc(100vw - 24px)', height: 540 }}
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
                  {/* Action chips */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.actions.map((a, j) => (
                        <span key={j} className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {iconFor[a.type] ?? <CheckSquare size={11} />}
                          {a.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 dark:bg-racing-800">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
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
                placeholder={'Was soll ich tun? z.B. "Erstelle eine Aufgabe für morgen"'}
                rows={1}
                className="flex-1 resize-none rounded-xl bg-gray-100 px-3 py-2 text-sm focus:outline-none dark:bg-racing-800 dark:text-racing-100"
                style={{ maxHeight: 96 }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 96) + 'px'
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
