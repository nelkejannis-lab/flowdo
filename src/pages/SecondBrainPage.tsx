import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
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
  ListChecks,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useBrainStore, NotePage, NoteColumn, NoteChecklistItem } from '../store/brainStore'
import { useBoardsStore } from '../store/boardsStore'
import { createId } from '../utils/id'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function SecondBrainPage() {
  const { t } = useTranslation('brain')
  const columns = useBrainStore((s) => s.columns)
  const pages = useBrainStore((s) => s.pages)
  const boards = useBoardsStore((s) => s.boards)
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
  const [activeTab, setActiveTab] = useState<'all' | string>('all')
  const [activePage, setActivePage] = useState<NotePage | null>(null)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [newColTitle, setNewColTitle] = useState('')
  const [editingColId, setEditingColId] = useState<string | null>(null)
  const [editingColTitle, setEditingColTitle] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  // State inside note creation
  const [isCreating, setIsCreating] = useState(false)
  const [createColId, setCreateColId] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteChecklist, setNoteChecklist] = useState<NoteChecklistItem[]>([])
  const [noteTags, setNoteTags] = useState('')
  const [notePeople, setNotePeople] = useState('')
  const [noteLinkedBoardId, setNoteLinkedBoardId] = useState('')

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

  // Filter pages based on search query + active tab
  const filteredPages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    let list = pages
    if (activeTab !== 'all') list = list.filter((p) => p.columnId === activeTab)
    if (q) {
      list = list.filter(
        (p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || (p.summary && p.summary.toLowerCase().includes(q))
      )
    }
    return [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [pages, searchQuery, activeTab])

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
      alert(t('noAudioSupport'))
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
      alert(t('micDenied'))
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
      alert(t('emptyNoteAlert'))
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

      if (error) throw new Error(error.message || t('summaryError'))
      const summaryText = data?.text
      if (!summaryText) throw new Error(t('summaryEmptyError'))

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
      setAiError(err.message || t('genericError'))
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

  // Open note details/edit
  const handleOpenPage = (page: NotePage) => {
    setIsCreating(false)
    setActivePage(page)
    setNoteTitle(page.title)
    setNoteContent(page.content)
    setNoteTags((page.tags ?? []).join(', '))
    setNotePeople((page.people ?? []).map((p) => p.name).join(', '))
    setNoteLinkedBoardId(page.linkedBoardId ?? '')
    setAudioUrl(page.audioBase64 || null)
    setAudioBlob(null)
    setAiError(null)
    setJustSaved(false)
  }

  // Handle saving the page edits
  const handleSavePage = () => {
    if (!activePage) return
    updatePage(activePage.id, {
      title: noteTitle.trim() || t('untitledPage'),
      content: noteContent,
      tags: noteTags.split(',').map((s) => s.trim()).filter(Boolean),
      people: notePeople.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name })),
      linkedBoardId: noteLinkedBoardId || undefined,
    })
    setActivePage((prev) => (prev ? { ...prev, title: noteTitle.trim() || t('untitledPage'), content: noteContent } : null))
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1500)
  }

  // Open creation form
  const handleOpenCreate = (columnId: string) => {
    if (!columnId) return
    setActivePage(null)
    setCreateColId(columnId)
    setIsCreating(true)
    setNoteTitle('')
    setNoteContent('')
    setNoteChecklist([])
    setAudioUrl(null)
    setAudioBlob(null)
    setAiError(null)
  }

  // Save new note page
  const handleSaveNewPage = () => {
    if (!noteTitle.trim() && !noteContent.trim() && noteChecklist.length === 0) {
      setIsCreating(false)
      return
    }
    addPage(createColId, noteTitle.trim() || t('untitledPage'), noteContent, noteChecklist)

    if (audioBlob) {
      const reader = new FileReader()
      reader.readAsDataURL(audioBlob)
      reader.onloadend = () => {
        const base64data = reader.result as string
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

  const columnTitle = (id: string) => columns.find((c) => c.id === id)?.title ?? ''

  // Shared toolbar for the create/edit detail pane
  function Toolbar() {
    return (
      <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-100 dark:border-racing-800 pb-2">
        <button
          type="button"
          onClick={insertBulletPoint}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-racing-800 hover:text-gray-800 dark:hover:text-white"
          title={t('toolbar.insertBullet')}
        >
          <List size={13} />
          {t('toolbar.bulletLabel')}
        </button>
        <button
          type="button"
          onClick={toggleTranscription}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
            isTranscribing
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-gray-100 hover:bg-gray-200 dark:bg-racing-800 hover:text-gray-800 dark:hover:text-white'
          }`}
          title={isTranscribing ? t('toolbar.stopDictation') : t('toolbar.startDictation')}
        >
          {isTranscribing ? <MicOff size={13} /> : <Mic size={13} />}
          {isTranscribing ? t('toolbar.listening') : t('toolbar.dictate')}
        </button>
        <button
          type="button"
          onClick={isRecordingAudio ? stopRecordingAudio : startRecordingAudio}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
            isRecordingAudio
              ? 'bg-indigo-600 text-white animate-pulse'
              : 'bg-gray-100 hover:bg-gray-200 dark:bg-racing-800 hover:text-gray-800 dark:hover:text-white'
          }`}
          title={isRecordingAudio ? t('toolbar.stopRecording') : t('toolbar.recordVoiceNote')}
        >
          <Volume2 size={13} />
          {isRecordingAudio ? t('toolbar.stopRecording') : t('toolbar.recordAudio')}
        </button>
        <input
          type="file"
          accept="audio/*"
          className="hidden"
          id="audio-file-upload"
          onChange={(e) => handleAudioFileUpload(e, !!activePage)}
        />
        <button
          type="button"
          onClick={() => document.getElementById('audio-file-upload')?.click()}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-racing-800 hover:text-gray-800 dark:hover:text-white"
          title={t('toolbar.uploadAudioFile')}
        >
          <Upload size={13} />
          {t('toolbar.uploadAudio')}
        </button>
        <button
          type="button"
          disabled={aiLoading}
          onClick={generateAiSummary}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 ml-auto transition-colors"
          title={t('toolbar.generateSummary')}
        >
          <Sparkles size={13} className={aiLoading ? 'animate-spin' : ''} />
          {aiLoading ? t('toolbar.summarizing') : t('toolbar.summarize')}
        </button>
      </div>
    )
  }


  function AudioPlayback({ onDelete }: { onDelete?: () => void }) {
    if (!audioUrl) return null
    return (
      <div className="rounded-xl bg-indigo-50/50 dark:bg-racing-950/40 p-3 border border-indigo-100/50 dark:border-racing-850 flex flex-col gap-2">
        <span className="text-xs font-semibold text-indigo-500 flex items-center gap-1.5">
          <Volume2 size={13} /> {t('audio.play')}
        </span>
        <audio src={audioUrl} controls className="w-full" />
        {onDelete && (
          <button onClick={onDelete} className="text-[10px] text-red-500 hover:underline font-semibold self-start">
            {t('audio.delete')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-[75vh]">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left pane: search, tabs, list */}
        <div className="flex w-80 flex-shrink-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-xl border border-gray-200 bg-white dark:bg-racing-950/40 dark:border-racing-800 pl-9 pr-3 py-2 text-sm outline-none focus:border-accent transition-all"
              />
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <button
              onClick={() => handleOpenCreate(activeTab !== 'all' ? activeTab : columns[0]?.id ?? '')}
              disabled={columns.length === 0}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-white hover:bg-accent-dark disabled:opacity-40"
              title={t('newNote')}
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                activeTab === 'all'
                  ? 'bg-accent text-white'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800'
              }`}
            >
              {t('allTab')}
            </button>
            {columns.map((col) => (
              <button
                key={col.id}
                onClick={() => setActiveTab(col.id)}
                className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  activeTab === col.id
                    ? 'bg-accent text-white'
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800'
                }`}
              >
                {col.title}
              </button>
            ))}
            <button
              onClick={() => setShowAddColumn(true)}
              title={t('addCategory')}
              className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-accent dark:hover:bg-racing-800"
            >
              <FolderPlus size={14} />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {filteredPages.map((page) => (
              <button
                key={page.id}
                onClick={() => handleOpenPage(page)}
                className={`flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all duration-150 ${
                  activePage?.id === page.id
                    ? 'border-accent bg-accent/5'
                    : 'border-gray-100 bg-white hover:border-accent/30 dark:border-racing-850 dark:bg-racing-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm break-words truncate">{page.title}</h4>
                  <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider text-gray-400 bg-black/[0.04] dark:bg-white/[0.05] rounded-full px-1.5 py-0.5">
                    {columnTitle(page.columnId)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-racing-300 line-clamp-2 leading-relaxed whitespace-pre-wrap">
                  {page.content || '...'}
                </p>
                <div className="flex items-center gap-2">
                  {page.audioBase64 && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 px-1.5 py-0.5 rounded-md">
                      <Volume2 size={10} /> Audio
                    </span>
                  )}
                  {page.summary && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-md">
                      <Sparkles size={10} /> {t('aiLabel')}
                    </span>
                  )}
                  {page.checklist && page.checklist.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-1.5 py-0.5 rounded-md">
                      <ListChecks size={10} /> {page.checklist.filter((c) => c.done).length}/{page.checklist.length}
                    </span>
                  )}
                  <span className="text-[9px] text-gray-400 ml-auto">
                    {new Date(page.updatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </button>
            ))}

            {filteredPages.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 dark:border-racing-800 rounded-xl select-none">
                {t('noNotes')}
              </div>
            )}
          </div>
        </div>

        {/* Right pane: detail editor */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-100 dark:border-racing-850 bg-white/70 dark:bg-racing-900/70 p-5 backdrop-blur-apple">
          {isCreating ? (
            <div className="flex flex-col gap-4">
              <input
                autoFocus
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder={t('editor.titlePlaceholder')}
                className="w-full text-lg font-bold bg-transparent border-b border-gray-100 dark:border-racing-800 focus:border-accent focus:outline-none pb-1.5"
              />
              <Toolbar />
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">{t('editor.categoryLabel')}</label>
                <select
                  value={createColId}
                  onChange={(e) => setCreateColId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-xs focus:border-accent focus:outline-none dark:border-racing-700 font-medium"
                >
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder={t('editor.contentPlaceholder')}
                rows={10}
                className="w-full rounded-xl border border-gray-200 bg-transparent px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700 leading-relaxed"
              />
              <BrainChecklist
                items={noteChecklist}
                onAdd={(text) => setNoteChecklist((prev) => [...prev, { id: createId(), text, done: false }])}
                onToggle={(id) => setNoteChecklist((prev) => prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)))}
                onDelete={(id) => setNoteChecklist((prev) => prev.filter((it) => it.id !== id))}
              />
              <AudioPlayback />
              {aiError && <p className="text-xs text-red-500">{aiError}</p>}
              <div className="flex justify-end gap-2 mt-1 pt-3 border-t border-gray-100 dark:border-racing-800">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-racing-800 dark:hover:bg-racing-800"
                >
                  {t('editor.discard')}
                </button>
                <button
                  onClick={handleSaveNewPage}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark transition-all shadow-sm"
                >
                  {t('editor.saveAndCreate')}
                </button>
              </div>
            </div>
          ) : activePage ? (
            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder={t('editor.titlePlaceholderEdit')}
                className="w-full text-lg font-bold bg-transparent border-b border-gray-100 dark:border-racing-800 focus:border-accent focus:outline-none pb-1.5"
              />
              <Toolbar />
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">{t('editor.categoryLabel')}</label>
                <select
                  value={activePage.columnId}
                  onChange={(e) => {
                    const colId = e.target.value
                    updatePage(activePage.id, { columnId: colId })
                    setActivePage((prev) => (prev ? { ...prev, columnId: colId } : null))
                  }}
                  className="w-full max-w-xs rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-xs focus:border-accent focus:outline-none dark:border-racing-700 font-medium"
                >
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={noteTags} onChange={(e) => setNoteTags(e.target.value)} placeholder="Tags (kommagetrennt)"
                  className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-xs dark:border-racing-700" />
                <input value={notePeople} onChange={(e) => setNotePeople(e.target.value)} placeholder="Personen (kommagetrennt)"
                  className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-xs dark:border-racing-700" />
              </div>
              {boards.length > 0 && (
                <select value={noteLinkedBoardId} onChange={(e) => setNoteLinkedBoardId(e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-xs dark:border-racing-700">
                  <option value="">Projekt verknüpfen…</option>
                  {boards.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              )}
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder={t('editor.contentPlaceholder')}
                rows={10}
                className="w-full rounded-xl border border-gray-200 bg-transparent px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700 leading-relaxed"
              />
              <BrainChecklist
                items={activePage.checklist ?? []}
                onAdd={(text) => {
                  const updated = [...(activePage.checklist ?? []), { id: createId(), text, done: false }]
                  updatePage(activePage.id, { checklist: updated })
                  setActivePage((prev) => (prev ? { ...prev, checklist: updated } : null))
                }}
                onToggle={(id) => {
                  const updated = (activePage.checklist ?? []).map((it) => (it.id === id ? { ...it, done: !it.done } : it))
                  updatePage(activePage.id, { checklist: updated })
                  setActivePage((prev) => (prev ? { ...prev, checklist: updated } : null))
                }}
                onDelete={(id) => {
                  const updated = (activePage.checklist ?? []).filter((it) => it.id !== id)
                  updatePage(activePage.id, { checklist: updated })
                  setActivePage((prev) => (prev ? { ...prev, checklist: updated } : null))
                }}
              />
              <AudioPlayback
                onDelete={() => {
                  if (confirm(t('audio.confirmDelete'))) {
                    setAudioUrl(null)
                    updatePage(activePage.id, { audioBase64: undefined })
                    setActivePage((prev) => (prev ? { ...prev, audioBase64: undefined } : null))
                  }
                }}
              />
              {activePage.summary && (
                <div className="rounded-xl bg-emerald-50/50 dark:bg-racing-950/40 p-3.5 border border-emerald-100/50 dark:border-racing-850 flex flex-col gap-2">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Sparkles size={13} /> {t('editor.aiSummaryTitle')}
                  </span>
                  <div className="text-xs leading-relaxed text-gray-700 dark:text-racing-200 whitespace-pre-wrap border-l-2 border-emerald-400 pl-3">
                    {activePage.summary}
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(t('editor.confirmDeleteSummary'))) {
                        updatePage(activePage.id, { summary: undefined })
                        setActivePage((prev) => (prev ? { ...prev, summary: undefined } : null))
                      }
                    }}
                    className="text-[10px] text-red-500 hover:underline font-semibold self-start"
                  >
                    {t('editor.deleteSummary')}
                  </button>
                </div>
              )}
              {aiError && <p className="text-xs text-red-500">{aiError}</p>}
              <div className="flex justify-between items-center mt-1 pt-3 border-t border-gray-100 dark:border-racing-800">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(t('editor.confirmDeleteNote'))) {
                      deletePage(activePage.id)
                      setActivePage(null)
                    }
                  }}
                  className="text-sm font-semibold text-red-500 hover:underline"
                >
                  {t('editor.delete')}
                </button>
                <button
                  onClick={handleSavePage}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark transition-all shadow-sm"
                >
                  {justSaved ? t('editor.saved') : t('editor.save')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[40vh] flex-col items-center justify-center text-center text-gray-400">
              <FileText size={32} className="mb-3 opacity-40" />
              <p className="text-sm">{t('editor.emptyState')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Spalte hinzufügen Popover */}
      {showAddColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4" onClick={() => setShowAddColumn(false)}>
          <div
            className="bg-white dark:bg-racing-900 border border-gray-100 dark:border-racing-850 rounded-2xl p-5 shadow-2xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold mb-3">{t('categoryModal.title')}</h3>
            <form onSubmit={handleCreateColumn} className="flex flex-col gap-3">
              <input
                autoFocus
                type="text"
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                placeholder={t('categoryModal.namePlaceholder')}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
              {columns.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t('categoryModal.existing')}</span>
                  {columns.map((col) => (
                    <div key={col.id} className="flex items-center gap-1.5">
                      {editingColId === col.id ? (
                        <>
                          <input
                            autoFocus
                            value={editingColTitle}
                            onChange={(e) => setEditingColTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), saveRenameCol(col.id))}
                            className="flex-1 bg-white dark:bg-racing-900 border border-gray-200 rounded px-1.5 py-0.5 text-sm outline-none focus:border-accent"
                          />
                          <button type="button" onClick={() => saveRenameCol(col.id)} className="text-emerald-500 hover:text-emerald-600 rounded p-0.5">
                            <Check size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 truncate text-sm">{col.title}</span>
                          <button type="button" onClick={() => startRenameCol(col)} className="text-gray-400 hover:text-gray-600 dark:hover:text-racing-100 rounded p-0.5">
                            <Edit2 size={12} />
                          </button>
                          {columns.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(t('categoryModal.confirmDelete', { name: col.title }))) {
                                  deleteColumn(col.id)
                                  if (activeTab === col.id) setActiveTab('all')
                                }
                              }}
                              className="text-gray-400 hover:text-red-500 rounded p-0.5"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setShowAddColumn(false)}
                  className="rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 dark:border-racing-800 dark:hover:bg-racing-800"
                >
                  {t('categoryModal.close')}
                </button>
                <button type="submit" className="rounded-lg bg-accent text-white px-3 py-2 hover:bg-accent-dark">
                  {t('categoryModal.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Structured checklist (todos/Stichpunkte) inside a note, alongside the freeform text.
// Defined at module scope (not nested in SecondBrainPage) so it keeps a stable identity
// across the parent's re-renders — otherwise the new-item input loses focus on every keystroke.
function BrainChecklist({
  items,
  onAdd,
  onToggle,
  onDelete,
}: {
  items: NoteChecklistItem[]
  onAdd: (text: string) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation('brain')
  const [draft, setDraft] = useState('')
  function commit() {
    if (!draft.trim()) return
    onAdd(draft.trim())
    setDraft('')
  }
  return (
    <div className="rounded-xl border border-gray-200 dark:border-racing-700 p-3.5">
      <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-racing-300">
        <ListChecks size={13} /> {t('checklist.title')}
      </span>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <div key={item.id} className="group flex items-center gap-2 py-0.5">
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                item.done ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-racing-600'
              }`}
            >
              {item.done && <Check size={10} />}
            </button>
            <span className={`flex-1 text-sm ${item.done ? 'text-gray-400 line-through' : ''}`}>{item.text}</span>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs italic text-gray-400">{t('checklist.empty')}</p>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('checklist.addPlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          className="flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
        />
        <button type="button" onClick={commit} className="rounded-lg bg-accent p-1.5 text-white hover:bg-accent-dark">
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}
