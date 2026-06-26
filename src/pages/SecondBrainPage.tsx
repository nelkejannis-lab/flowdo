import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Plus,
  Trash2,
  Search,
  Sparkles,
  X,
  Check,
  Edit2,
  Volume2,
  FolderPlus,
  FileText,
  List,
  Upload,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useBrainStore, NotePage, NoteColumn } from '../store/brainStore'
import Modal from '../components/layout/Modal'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function SecondBrainPage() {
  const { t } = useTranslation(['common'])
  const columns = useBrainStore((s) => s.columns)
  const pages = useBrainStore((s) => s.pages)
  const addColumn = useBrainStore((s) => s.addColumn)
  const updateColumn = useBrainStore((s) => s.updateColumn)
  const deleteColumn = useBrainStore((s) => s.deleteColumn)
  const addPage = useBrainStore((s) => s.addPage)
  const updatePage = useBrainStore((s) => s.updatePage)
  const deletePage = useBrainStore((s) => s.deletePage)
  const fetchAll = useBrainStore((s) => s.fetchAll)
  const subscribeToBrain = useBrainStore((s) => s.subscribeToBrain)

  useEffect(() => {
    if (isSupabaseConfigured) {
      void fetchAll()
      const unsubscribe = subscribeToBrain()
      return () => unsubscribe()
    }
  }, [fetchAll, subscribeToBrain])

  const [searchQuery, setSearchQuery] = useState('')
  const [activePage, setActivePage] = useState<NotePage | null>(null)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [newColTitle, setNewColTitle] = useState('')
  const [editingColId, setEditingColId] = useState<string | null>(null)
  const [editingColTitle, setEditingColTitle] = useState('')

  // State inside note creation modal
  const [isCreating, setIsCreating] = useState(false)
  const [createColId, setCreateColId] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')

  // Speech Recognition & Recording states (for editing/creating notes)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)

  // Filter pages based on search query
  const filteredPages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return pages
    return pages.filter(
      (p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || (p.summary && p.summary.toLowerCase().includes(q))
    )
  }, [pages, searchQuery])

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const rec = new SpeechRecognition()
      rec.lang = 'de-DE'
      rec.continuous = true
      rec.interimResults = false

      rec.onresult = (event: any) => {
        const lastResultIndex = event.results.length - 1
        const text = event.results[lastResultIndex][0].transcript
        if (activePage) {
          setNoteContent((prev) => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + text)
        } else if (isCreating) {
          setNoteContent((prev) => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + text)
        }
      }

      rec.onerror = (e: any) => {
        console.error('Speech recognition error:', e)
        setIsTranscribing(false)
      }

      rec.onend = () => {
        setIsTranscribing(false)
      }

      recognitionRef.current = rec
    }
  }, [activePage, isCreating])

  // Speech Recognition toggle
  const toggleTranscription = () => {
    if (!recognitionRef.current) {
      alert('Spracherkennung wird in diesem Browser leider nicht unterstützt (Empfohlen: Chrome, Edge, Safari).')
      return
    }

    if (isTranscribing) {
      recognitionRef.current.stop()
      setIsTranscribing(false)
    } else {
      try {
        recognitionRef.current.start()
        setIsTranscribing(true)
      } catch (err) {
        console.error(err)
      }
    }
  }

  // Audio Recording toggle
  const startRecordingAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        setAudioBlob(audioBlob)
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        setIsRecordingAudio(false)

        // Convert blob to base64
        const reader = new FileReader()
        reader.readAsDataURL(audioBlob)
        reader.onloadend = () => {
          const base64data = reader.result as string
          if (activePage) {
            updatePage(activePage.id, { audioBase64: base64data })
            setActivePage((prev) => (prev ? { ...prev, audioBase64: base64data } : null))
          }
        }
      }

      mediaRecorder.start()
      setIsRecordingAudio(true)
    } catch (err) {
      console.error('Microphone access denied or error:', err)
      alert('Mikrofon-Zugriff verweigert oder Fehler aufgetreten.')
    }
  }

  const stopRecordingAudio = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop()
    }
  }

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>, forEdit: boolean) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!noteTitle) {
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      setNoteTitle(nameWithoutExt)
    }

    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    setAudioBlob(file)

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = () => {
      const base64data = reader.result as string
      if (forEdit && activePage) {
        updatePage(activePage.id, { audioBase64: base64data })
        setActivePage((prev) => (prev ? { ...prev, audioBase64: base64data } : null))
      }
    }
  }

  // Generate AI Summary calling ai-chat Supabase Edge Function
  const generateAiSummary = async () => {
    const isAudioOnly = audioBlob && !noteContent.trim()
    const textToSummarize = noteContent.trim()
    if (!textToSummarize && !audioBlob) {
      alert('Der Inhalt der Notiz ist leer und keine Audiodatei hochgeladen. Bitte schreibe etwas oder lade eine Audiodatei hoch.')
      return
    }

    setAiLoading(true)
    setAiError(null)

    try {
      if (!isSupabaseConfigured) {
        // Mock offline summary
        setTimeout(() => {
          const mockSummary = `### 📝 KI-Zusammenfassung (Offline-Modus)
- **Hauptthema**: ${noteTitle || 'Unbenannte Notiz'}
- **Zusammenfassung**: Dies ist ein lokaler Platzhalter für die Zusammenfassung. Verbinde dich mit Supabase, um automatische KI-Zusammenfassungen mit Claude zu generieren.
${audioBlob ? `- **Audiodatei**: ${audioBlob.name}\n` : ''}- **Erstellungsdatum**: ${new Date().toLocaleDateString('de-DE')}`
          if (activePage) {
            updatePage(activePage.id, { summary: mockSummary })
            setActivePage((prev) => (prev ? { ...prev, summary: mockSummary } : null))
          } else {
            // If creating, store it in state
            setNoteContent((prev) => prev + '\n\n' + mockSummary)
          }
          setAiLoading(false)
        }, 1500)
        return
      }

      let userPrompt = ''
      if (isAudioOnly) {
        userPrompt = `Ich habe eine Audiodatei hochgeladen.
Dateiname: ${audioBlob!.name}
Bitte erstelle ein strukturiertes Protokoll und eine detaillierte Zusammenfassungsvorlage für diese Aufnahme basierend auf dem Dateinamen und dem Thema. Bring Ordnung und Struktur in dieses Meeting/Gespräch.
Formatiere das Ergebnis in schönem Markdown mit Überschriften, Bulletpoints und einem Bereich für 'Action Items'.`
      } else {
        userPrompt = `Bitte fasse die folgende Notiz (und eventuelle Audiodatei ${audioBlob ? `"${audioBlob.name}"` : ''}) strukturiert, übersichtlich und prägnant auf Deutsch zusammen.
Verwende Überschriften und Stichpunkte. Bring Ordnung in unstrukturierte Mitschriften oder Protokolle.

Titel: ${noteTitle || 'Ohne Titel'}
Inhalt:
${textToSummarize}`
      }

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          systemPrompt:
            'Du bist ein nützlicher KI-Assistent für ein Notizbuch. Formatiere den übergebenen Text in ein sauberes, professionelles deutsches Protokoll/Zusammenfassung mit Markdown (Überschriften, Stichpunkte). Antworte ausschließlich mit der formatierten Zusammenfassung ohne Einleitung oder Erklärung.',
        },
      })

      if (error) throw new Error(error.message || 'Fehler beim Laden der KI-Zusammenfassung')
      const summaryText = data?.text
      if (!summaryText) throw new Error('Die KI hat keine Zusammenfassung zurückgegeben.')

      if (activePage) {
        updatePage(activePage.id, { summary: summaryText })
        setActivePage((prev) => (prev ? { ...prev, summary: summaryText } : null))
      } else {
        // Append or set summary in the creation form
        setNoteContent(
          (prev) =>
            `${prev}\n\n### 🤖 KI Zusammenfassung\n${summaryText}`
        )
      }
    } catch (err: any) {
      console.error(err)
      setAiError(err.message || 'Ein Fehler ist aufgetreten.')
    } finally {
      setAiLoading(false)
    }
  }

  // Formatting helper: Insert bullet point
  const insertBulletPoint = () => {
    setNoteContent((prev) => {
      if (prev.endsWith('\n') || prev === '') {
        return prev + '• '
      }
      return prev + '\n• '
    })
  }

  // Open note details/edit modal
  const handleOpenPage = (page: NotePage) => {
    setActivePage(page)
    setNoteTitle(page.title)
    setNoteContent(page.content)
    setAudioUrl(page.audioBase64 || null)
    setAiError(null)
    setIsCreating(false)
  }

  // Handle saving the page edits
  const handleSavePage = () => {
    if (!activePage) return
    updatePage(activePage.id, {
      title: noteTitle.trim() || 'Unbenannte Seite',
      content: noteContent,
    })
    setActivePage(null)
  }

  // Open creation modal
  const handleOpenCreate = (columnId: string) => {
    setCreateColId(columnId)
    setIsCreating(true)
    setNoteTitle('')
    setNoteContent('')
    setAudioUrl(null)
    setAudioBlob(null)
    setAiError(null)
  }

  // Save new note page
  const handleSaveNewPage = () => {
    if (!noteTitle.trim() && !noteContent.trim()) {
      setIsCreating(false)
      return
    }
    // Add page
    addPage(createColId, noteTitle.trim() || 'Unbenannte Seite', noteContent)

    // Save audio if any was recorded
    if (audioBlob) {
      const reader = new FileReader()
      reader.readAsDataURL(audioBlob)
      reader.onloadend = () => {
        const base64data = reader.result as string
        // Find latest page created and update its audio
        const latest = useBrainStore.getState().pages[0]
        if (latest) {
          updatePage(latest.id, { audioBase64: base64data })
        }
      }
    }

    setIsCreating(false)
  }

  // Add Column Form Submission
  const handleCreateColumn = (e: React.FormEvent) => {
    e.preventDefault()
    if (newColTitle.trim()) {
      addColumn(newColTitle.trim())
      setNewColTitle('')
      setShowAddColumn(false)
    }
  }

  // Start Column Rename
  const startRenameCol = (col: NoteColumn) => {
    setEditingColId(col.id)
    setEditingColTitle(col.title)
  }

  // Save Column Rename
  const saveRenameCol = (id: string) => {
    if (editingColTitle.trim()) {
      updateColumn(id, editingColTitle.trim())
      setEditingColId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 h-full min-h-[75vh]">
      {/* Top Search & Actions bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white/70 dark:bg-racing-900/70 p-4 rounded-2xl border border-gray-100 dark:border-racing-850 backdrop-blur-apple shadow-sm">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Notizbuch durchsuchen (Inhalt, Titel, KI)..."
            className="w-full rounded-xl border border-gray-200 bg-white dark:bg-racing-950/40 dark:border-racing-800 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-accent transition-all shadow-inner"
          />
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-racing-200"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowAddColumn(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark transition-all duration-200 shadow-sm hover:shadow-apple-sm active:scale-95"
        >
          <FolderPlus size={16} />
          Spalte hinzufügen
        </button>
      </div>

      {/* Spalte hinzufügen Popover/Inline Form */}
      {showAddColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-racing-900 border border-gray-100 dark:border-racing-850 rounded-2xl p-5 shadow-2xl max-w-sm w-full">
            <h3 className="text-base font-bold mb-3">Neue Spalte erstellen</h3>
            <form onSubmit={handleCreateColumn} className="flex flex-col gap-3">
              <input
                autoFocus
                type="text"
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                placeholder="z.B. Meetings, Ideen, Archiv..."
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
              <div className="flex justify-end gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setShowAddColumn(false)}
                  className="rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 dark:border-racing-800 dark:hover:bg-racing-800"
                >
                  Abbrechen
                </button>
                <button type="submit" className="rounded-lg bg-accent text-white px-3 py-2 hover:bg-accent-dark">
                  Erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Column Kanban Layout */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin select-none snap-x snap-mandatory">
        {columns.map((col) => {
          const colPages = filteredPages.filter((p) => p.columnId === col.id)
          const isEditing = editingColId === col.id

          return (
            <div
              key={col.id}
              className="flex-shrink-0 w-80 bg-gray-50/55 dark:bg-racing-950/20 border border-gray-100 dark:border-racing-850 rounded-2xl p-4 flex flex-col max-h-[70vh] overflow-hidden snap-start"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                {isEditing ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <input
                      autoFocus
                      value={editingColTitle}
                      onChange={(e) => setEditingColTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveRenameCol(col.id)}
                      className="w-full bg-white dark:bg-racing-900 border border-gray-200 rounded px-1.5 py-0.5 text-sm font-semibold outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => saveRenameCol(col.id)}
                      className="text-emerald-500 hover:text-emerald-600 rounded p-0.5"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-gray-800 dark:text-racing-100 truncate">{col.title}</h3>
                    <span className="text-[10px] font-bold bg-black/[0.04] text-gray-400 dark:bg-white/[0.05] dark:text-racing-300 rounded-full px-1.5 py-0.5">
                      {colPages.length}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleOpenCreate(col.id)}
                    className="p-1.5 text-gray-400 hover:text-accent rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                    title="Notiz in dieser Spalte erstellen"
                  >
                    <Plus size={15} />
                  </button>
                  <button
                    onClick={() => (isEditing ? setEditingColId(null) : startRenameCol(col))}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-racing-100 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  {columns.length > 1 && (
                    <button
                      onClick={() => {
                        if (confirm(`Möchtest du die Spalte "${col.title}" wirklich löschen?`)) {
                          deleteColumn(col.id)
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Column Pages Container */}
              <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-1">
                {colPages.map((page) => (
                  <div
                    key={page.id}
                    onClick={() => handleOpenPage(page)}
                    className="bg-white dark:bg-racing-900 border border-gray-100 dark:border-racing-850 p-3.5 rounded-xl shadow-sm hover:shadow-apple-sm hover:border-accent/40 dark:hover:border-accent/30 cursor-pointer transition-all duration-200 flex flex-col gap-2 relative group"
                  >
                    <h4 className="font-semibold text-sm break-words pr-4">{page.title}</h4>
                    <p className="text-xs text-gray-400 dark:text-racing-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {page.content}
                    </p>

                    {/* Metadata / Indicators */}
                    <div className="flex items-center gap-2 mt-1">
                      {page.audioBase64 && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 px-1.5 py-0.5 rounded-md">
                          <Volume2 size={10} /> Audio
                        </span>
                      )}
                      {page.summary && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-md">
                          <Sparkles size={10} /> KI-Summary
                        </span>
                      )}
                      <span className="text-[9px] text-gray-400 ml-auto">
                        {new Date(page.updatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>

                    {/* Quick Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Notiz "${page.title}" wirklich löschen?`)) {
                          deletePage(page.id)
                        }
                      }}
                      className="absolute top-2.5 right-2 text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                {colPages.length === 0 && (
                  <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 dark:border-racing-800 rounded-xl select-none">
                    Keine Notizen
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Note Edit Modal */}
      {activePage && (
        <Modal title="Notiz anzeigen / bearbeiten" onClose={() => setActivePage(null)}>
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Titel deiner Notiz..."
              className="w-full text-lg font-bold bg-transparent border-b border-gray-100 dark:border-racing-800 focus:border-accent focus:outline-none pb-1.5"
            />

            {/* Formatting Helper & Voice tools */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-100 dark:border-racing-800 pb-2">
              <button
                type="button"
                onClick={insertBulletPoint}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-racing-800 hover:text-gray-800 dark:hover:text-white"
                title="Stichpunkt einfügen"
              >
                <List size={13} />
                Stichpunkt
              </button>

              <button
                type="button"
                onClick={toggleTranscription}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  isTranscribing
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-racing-800 hover:text-gray-800 dark:hover:text-white'
                }`}
                title={isTranscribing ? 'Spracherkennung stoppen' : 'Spracherkennung starten (Diktieren)'}
              >
                {isTranscribing ? <MicOff size={13} /> : <Mic size={13} />}
                {isTranscribing ? 'Hört zu...' : 'Diktieren'}
              </button>

              <button
                type="button"
                onClick={isRecordingAudio ? stopRecordingAudio : startRecordingAudio}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  isRecordingAudio
                    ? 'bg-indigo-600 text-white animate-pulse'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-racing-800 hover:text-gray-800 dark:hover:text-white'
                }`}
                title={isRecordingAudio ? 'Aufnahme stoppen' : 'Sprachnotiz aufnehmen'}
              >
                <Volume2 size={13} />
                {isRecordingAudio ? 'Aufnahme stoppen' : 'Audio aufnehmen'}
              </button>

              <input
                type="file"
                accept="audio/*"
                className="hidden"
                id="audio-file-upload-edit"
                onChange={(e) => handleAudioFileUpload(e, true)}
              />
              <button
                type="button"
                onClick={() => document.getElementById('audio-file-upload-edit')?.click()}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-racing-800 hover:text-gray-800 dark:hover:text-white"
                title="Audiodatei hochladen"
              >
                <Upload size={13} />
                Audio hochladen
              </button>

              <button
                type="button"
                disabled={aiLoading}
                onClick={generateAiSummary}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 ml-auto transition-colors"
                title="KI Zusammenfassung erstellen"
              >
                <Sparkles size={13} className={aiLoading ? 'animate-spin' : ''} />
                {aiLoading ? 'Fasst zusammen...' : 'KI Zusammenfassen'}
              </button>
            </div>

            {/* Note Text area */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Inhalt</label>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Schreibe deine Gedanken auf oder füge Stichpunkte hinzu..."
                rows={8}
                className="w-full rounded-xl border border-gray-200 bg-transparent px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700 leading-relaxed"
              />
            </div>

            {/* Category / Column move dropdown */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">In Spalte ablegen</label>
                <select
                  value={activePage.columnId}
                  onChange={(e) => {
                    const colId = e.target.value
                    updatePage(activePage.id, { columnId: colId })
                    setActivePage((prev) => (prev ? { ...prev, columnId: colId } : null))
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 focus:border-accent focus:outline-none dark:border-racing-700 font-medium"
                >
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Audio Memo Playback (if exists) */}
            {audioUrl && (
              <div className="rounded-xl bg-indigo-50/50 dark:bg-racing-950/40 p-3 border border-indigo-100/50 dark:border-racing-850 flex flex-col gap-2">
                <span className="text-xs font-semibold text-indigo-500 flex items-center gap-1.5">
                  <Volume2 size={13} /> Sprachaufzeichnung abspielen
                </span>
                <audio src={audioUrl} controls className="w-full" />
                <button
                  onClick={() => {
                    if (confirm('Möchtest du diese Sprachaufnahme löschen?')) {
                      setAudioUrl(null)
                      updatePage(activePage.id, { audioBase64: undefined })
                      setActivePage((prev) => (prev ? { ...prev, audioBase64: undefined } : null))
                    }
                  }}
                  className="text-[10px] text-red-500 hover:underline font-semibold self-start"
                >
                  Sprachaufnahme löschen
                </button>
              </div>
            )}

            {/* AI Summary Display (if exists) */}
            {activePage.summary && (
              <div className="rounded-xl bg-emerald-50/50 dark:bg-racing-950/40 p-3.5 border border-emerald-100/50 dark:border-racing-850 flex flex-col gap-2">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles size={13} /> KI Zusammenfassung
                </span>
                <div className="text-xs leading-relaxed text-gray-700 dark:text-racing-200 whitespace-pre-wrap border-l-2 border-emerald-400 pl-3">
                  {activePage.summary}
                </div>
                <button
                  onClick={() => {
                    if (confirm('KI-Zusammenfassung löschen?')) {
                      updatePage(activePage.id, { summary: undefined })
                      setActivePage((prev) => (prev ? { ...prev, summary: undefined } : null))
                    }
                  }}
                  className="text-[10px] text-red-500 hover:underline font-semibold self-start"
                >
                  Zusammenfassung löschen
                </button>
              </div>
            )}

            {aiError && <p className="text-xs text-red-500">{aiError}</p>}

            {/* Modal Actions */}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 dark:border-racing-800">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Möchtest du diese Notiz wirklich löschen?')) {
                    deletePage(activePage.id)
                    setActivePage(null)
                  }
                }}
                className="text-sm font-semibold text-red-500 hover:underline"
              >
                Löschen
              </button>
              <button
                onClick={handleSavePage}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark transition-all shadow-sm"
              >
                Speichern & Schließen
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Note Creation Modal */}
      {isCreating && (
        <Modal title="Neue Notiz erstellen" onClose={() => setIsCreating(false)}>
          <div className="flex flex-col gap-4">
            <input
              autoFocus
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Notiz Überschrift..."
              className="w-full text-lg font-bold bg-transparent border-b border-gray-100 dark:border-racing-800 focus:border-accent focus:outline-none pb-1.5"
            />

            {/* Formatting Helper & Voice tools */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-100 dark:border-racing-800 pb-2">
              <button
                type="button"
                onClick={insertBulletPoint}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-racing-800 hover:text-gray-800 dark:hover:text-white"
              >
                <List size={13} />
                Stichpunkt
              </button>

              <button
                type="button"
                onClick={toggleTranscription}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  isTranscribing
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-racing-800 hover:text-gray-800 dark:hover:text-white'
                }`}
                title={isTranscribing ? 'Spracherkennung stoppen' : 'Spracherkennung starten'}
              >
                {isTranscribing ? <MicOff size={13} /> : <Mic size={13} />}
                {isTranscribing ? 'Hört zu...' : 'Diktieren'}
              </button>

              <button
                type="button"
                onClick={isRecordingAudio ? stopRecordingAudio : startRecordingAudio}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  isRecordingAudio
                    ? 'bg-indigo-600 text-white animate-pulse'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-racing-800 hover:text-gray-800 dark:hover:text-white'
                }`}
              >
                <Volume2 size={13} />
                {isRecordingAudio ? 'Aufnahme stoppen' : 'Audio aufnehmen'}
              </button>

              <input
                type="file"
                accept="audio/*"
                className="hidden"
                id="audio-file-upload-create"
                onChange={(e) => handleAudioFileUpload(e, false)}
              />
              <button
                type="button"
                onClick={() => document.getElementById('audio-file-upload-create')?.click()}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-racing-800 hover:text-gray-800 dark:hover:text-white"
                title="Audiodatei hochladen"
              >
                <Upload size={13} />
                Audio hochladen
              </button>

              <button
                type="button"
                disabled={aiLoading}
                onClick={generateAiSummary}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 ml-auto transition-colors"
              >
                <Sparkles size={13} className={aiLoading ? 'animate-spin' : ''} />
                KI Zusammenfassen
              </button>
            </div>

            {/* Note Text area */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Inhalt</label>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Schreibe deine Gedanken auf oder füge Stichpunkte hinzu..."
                rows={8}
                className="w-full rounded-xl border border-gray-200 bg-transparent px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700 leading-relaxed"
              />
            </div>

            {/* Audio Playback during creation (if exists) */}
            {audioUrl && (
              <div className="rounded-xl bg-indigo-50/50 dark:bg-racing-950/40 p-3 border border-indigo-100/50 dark:border-racing-850 flex flex-col gap-2">
                <span className="text-xs font-semibold text-indigo-500 flex items-center gap-1.5">
                  <Volume2 size={13} /> Sprachaufzeichnung abspielen
                </span>
                <audio src={audioUrl} controls className="w-full" />
              </div>
            )}

            {aiError && <p className="text-xs text-red-500">{aiError}</p>}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-racing-800">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-racing-800 dark:hover:bg-racing-800"
              >
                Verwerfen
              </button>
              <button
                onClick={handleSaveNewPage}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark transition-all shadow-sm"
              >
                Speichern & Erstellen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
