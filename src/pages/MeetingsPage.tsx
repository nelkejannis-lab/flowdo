import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMeetingsStore } from '../store/meetingsStore'
import LiveMeetingPanel from '../components/meetings/LiveMeetingPanel'
import { Mic, Plus, Trash2, Calendar, FileText, CheckSquare, Pencil, Check, X, ChevronDown, ListChecks } from 'lucide-react'
import { format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { translateMeeting } from '../lib/aiService'
import { useTasksStore } from '../store/tasksStore'
import TaskFormModal from '../components/tasks/TaskFormModal'

export default function MeetingsPage() {
  const { t, i18n } = useTranslation('meetings')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const { meetings, fetchMeetings, deleteMeeting, updateMeeting, loading } = useMeetingsStore()
  const addTask = useTasksStore(s => s.addTask)
  const [isLiveMode, setIsLiveMode] = useState(false)
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [transferringItem, setTransferringItem] = useState<any>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [editingActionItemId, setEditingActionItemId] = useState<string | null>(null)
  const [actionItemTaskDraft, setActionItemTaskDraft] = useState('')
  const [actionItemAssigneeDraft, setActionItemAssigneeDraft] = useState('')
  const [addingActionItem, setAddingActionItem] = useState(false)
  const [expandedActionItemId, setExpandedActionItemId] = useState<string | null>(null)
  const [addingSubtaskForId, setAddingSubtaskForId] = useState<string | null>(null)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  if (isLiveMode) {
    return (
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t('liveMeetingTitle')}</h1>
          <button
            onClick={() => setIsLiveMode(false)}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            {t('backToOverview')}
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <LiveMeetingPanel onSaveComplete={() => setIsLiveMode(false)} />
        </div>
      </div>
    )
  }

  const selectedMeeting = meetings.find(m => m.id === selectedMeetingId)

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('pageTitle')}</h1>
        <button
          onClick={() => setIsLiveMode(true)}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-accent-hover transition-all"
        >
          <Mic size={16} /> {t('startLiveRecording')}
        </button>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left column: Meeting List */}
        <div className="w-1/3 flex flex-col gap-3 overflow-y-auto pr-2">
          {loading && <p className="text-sm text-gray-500">{t('loadingMeetings')}</p>}
          {!loading && meetings.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center dark:border-racing-700 dark:bg-racing-800/50">
              <Mic size={32} className="mb-2 text-gray-400" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('noMeetingsTitle')}</p>
              <p className="mt-1 text-xs text-gray-500">{t('noMeetingsDesc')}</p>
            </div>
          )}
          {meetings.map((meeting) => (
            <div 
              key={meeting.id}
              onClick={() => setSelectedMeetingId(meeting.id)}
              className={`group cursor-pointer rounded-xl border p-4 transition-all ${
                selectedMeetingId === meeting.id 
                  ? 'border-accent bg-accent/5 dark:bg-accent/10' 
                  : 'border-gray-100 bg-white hover:border-accent/30 dark:border-racing-800 dark:bg-racing-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">{meeting.title}</h3>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteMeeting(meeting.id)
                    if (selectedMeetingId === meeting.id) setSelectedMeetingId(null)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <Calendar size={12} />
                {format(new Date(meeting.date), 'dd. MMM yyyy, HH:mm', { locale: dateLocale })}{t('uhr') ? ` ${t('uhr')}` : ''}
              </p>
              <div className="mt-3 flex gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-racing-800 dark:text-gray-300">
                  <FileText size={10} /> {(meeting.transcript.match(/ /g) || []).length} {t('wordsLabel')}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                  <CheckSquare size={10} /> {meeting.action_items?.length || 0} Tasks
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Right column: Meeting Details */}
        <div className="flex-1 rounded-xl border border-gray-100 bg-white shadow-sm dark:border-racing-800 dark:bg-racing-900 overflow-y-auto">
          {selectedMeeting ? (
            <div className="p-6">
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    placeholder={t('titlePlaceholder')}
                    autoFocus
                    className="flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-xl font-bold focus:border-accent focus:outline-none dark:border-racing-700"
                  />
                  <button
                    onClick={() => {
                      if (titleDraft.trim()) updateMeeting(selectedMeeting.id, { title: titleDraft.trim() })
                      setEditingTitle(false)
                    }}
                    className="rounded-lg bg-accent p-1.5 text-white hover:bg-accent-hover"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setEditingTitle(false)}
                    className="rounded-lg bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200 dark:bg-racing-800"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  <h2 className="text-xl font-bold">{selectedMeeting.title}</h2>
                  <button
                    onClick={() => {
                      setTitleDraft(selectedMeeting.title)
                      setEditingTitle(true)
                    }}
                    className="text-gray-300 opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                    title={t('edit')}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              )}
              <p className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                <Calendar size={14} /> {format(new Date(selectedMeeting.date), 'dd. MMMM yyyy, HH:mm', { locale: dateLocale })}{t('uhr') ? ` ${t('uhr')}` : ''}
              </p>

              <div className="mt-8">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4 dark:border-racing-800">
                  <h3 className="flex items-center gap-2 font-semibold text-accent">
                    <CheckSquare size={18} /> {t('actionItemsTitle')}
                  </h3>
                  {!addingActionItem && (
                    <button
                      onClick={() => {
                        setActionItemTaskDraft('')
                        setActionItemAssigneeDraft('')
                        setAddingActionItem(true)
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
                    >
                      <Plus size={12} /> {t('addActionItem')}
                    </button>
                  )}
                </div>
                <ul className="space-y-2">
                  {(selectedMeeting.action_items ?? []).map((item) => {
                    const subtasks = item.subtasks ?? []
                    const subtaskDone = subtasks.filter((s) => s.done).length
                    const isExpanded = expandedActionItemId === item.id
                    return (
                    <li key={item.id} className="rounded-lg bg-gray-50 dark:bg-racing-800">
                    <div className="flex items-start gap-2 p-3">
                      {editingActionItemId === item.id ? (
                        <div className="flex flex-1 flex-col gap-2">
                          <input
                            value={actionItemTaskDraft}
                            onChange={(e) => setActionItemTaskDraft(e.target.value)}
                            placeholder={t('actionItemPlaceholder')}
                            autoFocus
                            className="rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              value={actionItemAssigneeDraft}
                              onChange={(e) => setActionItemAssigneeDraft(e.target.value)}
                              placeholder={t('assigneePlaceholder')}
                              className="flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                            />
                            <button
                              onClick={() => {
                                if (!actionItemTaskDraft.trim()) return
                                const updatedItems = (selectedMeeting.action_items ?? []).map((ai) =>
                                  ai.id === item.id
                                    ? { ...ai, task: actionItemTaskDraft.trim(), assignee: actionItemAssigneeDraft.trim() || undefined }
                                    : ai
                                )
                                updateMeeting(selectedMeeting.id, { action_items: updatedItems })
                                setEditingActionItemId(null)
                              }}
                              className="rounded-lg bg-accent p-1.5 text-white hover:bg-accent-hover"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingActionItemId(null)}
                              className="rounded-lg bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200 dark:bg-racing-700"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={item.done}
                            onChange={(e) => {
                              const updatedItems = (selectedMeeting.action_items ?? []).map((ai) =>
                                ai.id === item.id ? { ...ai, done: e.target.checked } : ai
                              )
                              updateMeeting(selectedMeeting.id, { action_items: updatedItems })
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <span className={`font-medium text-sm ${item.done ? 'text-gray-400 line-through' : ''}`}>{item.task}</span>
                            {item.assignee && (
                              <span className="ml-2 inline-flex rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                                @{item.assignee}
                              </span>
                            )}
                          </div>
                          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
                            {subtasks.length > 0 && (
                              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                <ListChecks size={11} />
                                {subtaskDone}/{subtasks.length}
                              </span>
                            )}
                            <button
                              onClick={() => setTransferringItem(item)}
                              disabled={item.done}
                              className="text-xs font-semibold text-accent hover:text-accent-hover disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                              {item.done ? t('inDashboard') : t('transferToDashboard')}
                            </button>
                            <button
                              onClick={() => {
                                setActionItemTaskDraft(item.task)
                                setActionItemAssigneeDraft(item.assignee ?? '')
                                setEditingActionItemId(item.id)
                              }}
                              className="text-gray-300 hover:text-accent"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => {
                                const updatedItems = (selectedMeeting.action_items ?? []).filter((ai) => ai.id !== item.id)
                                updateMeeting(selectedMeeting.id, { action_items: updatedItems })
                              }}
                              className="text-gray-300 hover:text-red-500"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button
                              onClick={() => setExpandedActionItemId(isExpanded ? null : item.id)}
                              className="text-gray-300 hover:text-gray-600 dark:hover:text-racing-200"
                              title={t('subtasks')}
                            >
                              <ChevronDown size={14} className={`transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {isExpanded && editingActionItemId !== item.id && (
                      <div className="flex flex-col gap-1.5 px-3 pb-3 pl-9">
                        {subtasks.map((sub) => (
                          <div key={sub.id} className="group flex items-center gap-2 py-0.5">
                            <button
                              onClick={() => {
                                const updatedItems = (selectedMeeting.action_items ?? []).map((ai) =>
                                  ai.id === item.id
                                    ? { ...ai, subtasks: (ai.subtasks ?? []).map((s) => (s.id === sub.id ? { ...s, done: !s.done } : s)) }
                                    : ai
                                )
                                updateMeeting(selectedMeeting.id, { action_items: updatedItems })
                              }}
                              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                sub.done ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-racing-600'
                              }`}
                            >
                              {sub.done && <Check size={10} />}
                            </button>
                            <span className={`flex-1 text-sm ${sub.done ? 'text-gray-400 line-through' : ''}`}>{sub.title}</span>
                            <button
                              onClick={() => {
                                const updatedItems = (selectedMeeting.action_items ?? []).map((ai) =>
                                  ai.id === item.id ? { ...ai, subtasks: (ai.subtasks ?? []).filter((s) => s.id !== sub.id) } : ai
                                )
                                updateMeeting(selectedMeeting.id, { action_items: updatedItems })
                              }}
                              className="text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                        {addingSubtaskForId === item.id ? (
                          <div className="flex items-center gap-2 py-0.5">
                            <input
                              value={newSubtaskTitle}
                              onChange={(e) => setNewSubtaskTitle(e.target.value)}
                              placeholder={t('subtaskPlaceholder')}
                              autoFocus
                              className="flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                              onKeyDown={(e) => {
                                if (e.key !== 'Enter' || !newSubtaskTitle.trim()) return
                                const updatedItems = (selectedMeeting.action_items ?? []).map((ai) =>
                                  ai.id === item.id
                                    ? { ...ai, subtasks: [...(ai.subtasks ?? []), { id: crypto.randomUUID(), title: newSubtaskTitle.trim(), done: false }] }
                                    : ai
                                )
                                updateMeeting(selectedMeeting.id, { action_items: updatedItems })
                                setNewSubtaskTitle('')
                              }}
                            />
                            <button
                              onClick={() => {
                                if (!newSubtaskTitle.trim()) return
                                const updatedItems = (selectedMeeting.action_items ?? []).map((ai) =>
                                  ai.id === item.id
                                    ? { ...ai, subtasks: [...(ai.subtasks ?? []), { id: crypto.randomUUID(), title: newSubtaskTitle.trim(), done: false }] }
                                    : ai
                                )
                                updateMeeting(selectedMeeting.id, { action_items: updatedItems })
                                setNewSubtaskTitle('')
                              }}
                              className="rounded-lg bg-accent p-1 text-white hover:bg-accent-hover"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => { setAddingSubtaskForId(null); setNewSubtaskTitle('') }}
                              className="rounded-lg bg-gray-100 p-1 text-gray-500 hover:bg-gray-200 dark:bg-racing-700"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAddingSubtaskForId(item.id); setNewSubtaskTitle('') }}
                            className="flex items-center gap-1 self-start text-xs font-semibold text-accent hover:text-accent-hover"
                          >
                            <Plus size={11} /> {t('addSubtask')}
                          </button>
                        )}
                      </div>
                    )}
                    </li>
                    )
                  })}
                  {addingActionItem && (
                    <li className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/5 p-3">
                      <input
                        value={actionItemTaskDraft}
                        onChange={(e) => setActionItemTaskDraft(e.target.value)}
                        placeholder={t('actionItemPlaceholder')}
                        autoFocus
                        className="rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          value={actionItemAssigneeDraft}
                          onChange={(e) => setActionItemAssigneeDraft(e.target.value)}
                          placeholder={t('assigneePlaceholder')}
                          className="flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                        />
                        <button
                          onClick={() => {
                            if (!actionItemTaskDraft.trim()) return
                            const newItem = {
                              id: crypto.randomUUID(),
                              task: actionItemTaskDraft.trim(),
                              assignee: actionItemAssigneeDraft.trim() || undefined,
                              done: false,
                            }
                            updateMeeting(selectedMeeting.id, { action_items: [...(selectedMeeting.action_items ?? []), newItem] })
                            setAddingActionItem(false)
                          }}
                          className="rounded-lg bg-accent p-1.5 text-white hover:bg-accent-hover"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setAddingActionItem(false)}
                          className="rounded-lg bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200 dark:bg-racing-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </li>
                  )}
                  {(selectedMeeting.action_items ?? []).length === 0 && !addingActionItem && (
                    <p className="py-2 text-center text-xs text-gray-400">{t('noActionItems')}</p>
                  )}
                </ul>
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4 dark:border-racing-800">
                  <h3 className="flex items-center gap-2 font-semibold text-gray-500">
                    <FileText size={18} className="text-gray-400" /> {t('summaryTitle')}
                  </h3>
                  <div className="flex items-center gap-3">
                    {!editingSummary && (
                      <button
                        onClick={() => {
                          setSummaryDraft(selectedMeeting.summary)
                          setEditingSummary(true)
                        }}
                        className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
                      >
                        <Pencil size={12} /> {t('edit')}
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          setIsTranslating(true)
                          const result = await translateMeeting(selectedMeeting.summary, selectedMeeting.transcript)
                          updateMeeting(selectedMeeting.id, { summary: result.summary, transcript: result.transcript })
                        } catch (err) {
                          console.error('Translation failed', err)
                        } finally {
                          setIsTranslating(false)
                        }
                      }}
                      disabled={isTranslating}
                      className="text-xs font-semibold text-accent hover:text-accent-hover disabled:opacity-50 transition-colors"
                    >
                      {isTranslating ? t('translating') : t('translateToEnglish')}
                    </button>
                  </div>
                </div>
                {editingSummary ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={summaryDraft}
                      onChange={(e) => setSummaryDraft(e.target.value)}
                      placeholder={t('summaryPlaceholder')}
                      rows={10}
                      autoFocus
                      className="w-full rounded-lg border border-gray-200 bg-transparent p-3 text-sm leading-relaxed focus:border-accent focus:outline-none dark:border-racing-700"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingSummary(false)}
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800"
                      >
                        <X size={13} /> {t('cancel')}
                      </button>
                      <button
                        onClick={() => {
                          updateMeeting(selectedMeeting.id, { summary: summaryDraft })
                          setEditingSummary(false)
                        }}
                        className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
                      >
                        <Check size={13} /> {t('save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert">
                    <div className="whitespace-pre-wrap text-sm">{selectedMeeting.summary}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">
              <p>{t('selectMeetingPrompt')}</p>
            </div>
          )}
        </div>
      </div>
      {transferringItem && (
        <TaskFormModal 
          defaultTitle={transferringItem.task}
          defaultDueDate={transferringItem.dueDate}
          onClose={() => setTransferringItem(null)}
          onSave={() => {
            if (selectedMeeting) {
              const updatedItems = selectedMeeting.action_items.map((ai: any) => 
                ai.id === transferringItem.id ? { ...ai, done: true } : ai
              )
              updateMeeting(selectedMeeting.id, { action_items: updatedItems })
            }
          }}
        />
      )}
    </div>
  )
}
