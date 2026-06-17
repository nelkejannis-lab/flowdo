import { useEffect, useRef, useState } from 'react'
import { Bot, Image, Mic, MicOff, Send, Sparkles, X, Plus, Calendar, CheckSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCalendarEntriesStore } from '../../store/calendarEntriesStore'
import { useTasksStore } from '../../store/tasksStore'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface Message {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
}

interface CreatedItem {
  type: 'event' | 'task'
  title: string
}

const SYSTEM_PROMPT = `Du bist ein freundlicher KI-Assistent in einer Kalender- und Aufgaben-App namens Mooncrew.
Heute ist ${format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })}.

Du kannst Termine und Aufgaben aus Texten, Bildern oder gesprochener Beschreibung erkennen und anlegen.
Wenn du Termine oder Aufgaben erkennst, antworte IMMER in diesem Format:

[Normaler Antwortsatz auf Deutsch]

ERSTELLE:
\`\`\`json
{
  "items": [
    {
      "type": "event",
      "title": "Titel",
      "date": "yyyy-MM-dd",
      "endDate": "yyyy-MM-dd oder null",
      "startTime": "HH:MM oder null",
      "endTime": "HH:MM oder null",
      "description": "Beschreibung oder null"
    },
    {
      "type": "task",
      "title": "Aufgabentitel",
      "dueDate": "yyyy-MM-dd oder null",
      "priority": "low|medium|high"
    }
  ]
}
\`\`\`

Wenn du kein Termin/Aufgabe erkennst, antworte einfach normal auf Deutsch ohne JSON.
Bei Bildern: Beschreibe kurz was du siehst und extrahiere alle erkennbaren Termine, Aufgaben oder Fristen.`

export default function AiChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; url: string } | null>(null)
  const [created, setCreated] = useState<CreatedItem[]>([])

  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const addEntry = useCalendarEntriesStore((s) => s.addEntry)
  const addTask = useTasksStore((s) => s.addTask)

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Hallo! Ich kann Termine und Aufgaben aus Text, Bildern oder Sprache erstellen. Beschreibe einfach was du brauchst, lade ein Foto hoch oder nutze das Mikrofon! 🎙️📸',
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
      const base64 = result.split(',')[1]
      const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      setPendingImage({ base64, mimeType, url: result })
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
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  function stopVoice() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  async function send() {
    const text = input.trim()
    if (!text && !pendingImage) return
    const userMsg: Message = {
      role: 'user',
      content: text || (pendingImage ? '(Bild hochgeladen)' : ''),
      imageUrl: pendingImage?.url,
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    const imgToSend = pendingImage
    setPendingImage(null)
    setLoading(true)
    setCreated([])

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          systemPrompt: SYSTEM_PROMPT,
          imageBase64: imgToSend?.base64 ?? null,
          imageMimeType: imgToSend?.mimeType ?? null,
        },
      })
      if (error) throw new Error(error.message)

      const reply: string = data?.text ?? 'Fehler: Keine Antwort erhalten.'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])

      // Parse and create items
      const jsonMatch = reply.match(/```json\n([\s\S]*?)```/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1])
          const items: CreatedItem[] = []
          for (const item of parsed.items ?? []) {
            if (item.type === 'event') {
              await addEntry({
                type: 'termin',
                title: item.title,
                date: item.date,
                endDate: item.endDate ?? null,
                startTime: item.startTime ?? null,
                endTime: item.endTime ?? null,
                description: item.description ?? null,
                color: '#10B981',
                allDay: !item.startTime,
              })
              items.push({ type: 'event', title: item.title })
            } else if (item.type === 'task') {
              await addTask({
                title: item.title,
                dueDate: item.dueDate ?? null,
                priority: item.priority ?? 'medium',
                completed: false,
                description: null,
                tags: [],
                subtasks: [],
                evening: false,
              })
              items.push({ type: 'task', title: item.title })
            }
          }
          if (items.length > 0) setCreated(items)
        } catch { /* JSON parse failed, ignore */ }
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Fehler: ${err instanceof Error ? err.message : String(err)}` }])
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // Format assistant message — hide raw JSON block
  function formatReply(content: string) {
    return content.replace(/ERSTELLE:\n```json[\s\S]*?```/g, '').trim()
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
      >
        {open ? <X size={22} className="text-white" /> : <Bot size={24} className="text-white" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex w-[350px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-racing-700 dark:bg-racing-900"
          style={{ height: '520px' }}>

          {/* Header */}
          <div className="flex items-center gap-2.5 bg-accent px-4 py-3">
            <Sparkles size={18} className="text-white" />
            <div>
              <p className="text-sm font-semibold text-white">KI-Assistent</p>
              <p className="text-[11px] text-white/70">Text · Bild · Sprache</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'rounded-tr-sm bg-accent text-white'
                    : 'rounded-tl-sm bg-gray-100 text-gray-800 dark:bg-racing-800 dark:text-racing-100'
                }`}>
                  {m.imageUrl && (
                    <img src={m.imageUrl} alt="Bild" className="mb-2 max-h-40 w-full rounded-lg object-cover" />
                  )}
                  <p className="whitespace-pre-wrap">{m.role === 'assistant' ? formatReply(m.content) : m.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 dark:bg-racing-800">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Created items confirmation */}
            {created.length > 0 && (
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
                <p className="mb-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">✓ Erstellt:</p>
                {created.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    {item.type === 'event' ? <Calendar size={11} /> : <CheckSquare size={11} />}
                    <span>{item.title}</span>
                  </div>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Image preview */}
          {pendingImage && (
            <div className="relative mx-3 mb-1">
              <img src={pendingImage.url} alt="Vorschau" className="h-16 w-16 rounded-lg object-cover" />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white"
              >
                <X size={10} />
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="border-t border-gray-100 px-3 py-2.5 dark:border-racing-700">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Termin beschreiben, Bild hochladen oder Mikrofon nutzen…"
                rows={1}
                className="flex-1 resize-none rounded-xl bg-gray-100 px-3 py-2 text-sm focus:outline-none dark:bg-racing-800 dark:text-racing-100"
                style={{ maxHeight: '96px', overflowY: 'auto' }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 96) + 'px'
                }}
              />
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  title="Bild hochladen"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-racing-800 dark:text-racing-300"
                >
                  <Image size={15} />
                </button>
                <button
                  onClick={listening ? stopVoice : startVoice}
                  title={listening ? 'Aufnahme stoppen' : 'Spracheingabe'}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-racing-800 dark:text-racing-300'
                  }`}
                >
                  {listening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                <button
                  onClick={send}
                  disabled={loading || (!input.trim() && !pendingImage)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
                >
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
