import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bookmark, Calendar, Clock, LayoutTemplate, Settings, Trash2 } from 'lucide-react'
import Modal from '../layout/Modal'
import AttachmentsField from '../shared/AttachmentsField'
import BoardMilestones from './BoardMilestones'
import { useBoardsStore, BOARD_COLORS } from '../../store/boardsStore'
import { useBoardPresetsStore } from '../../store/boardPresetsStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { useFriendsStore } from '../../store/friendsStore'
import { useAuthStore } from '../../store/authStore'
import type { Attachment, Board } from '../../types'

type Tab = 'general' | 'time' | 'dates' | 'presets' | 'milestones'

interface Props {
  board: Board
  onClose: () => void
}

const TIME_PRESETS = [15, 30, 45, 60, 90, 120] as const

export default function BoardSettingsModal({ board, onClose }: Props) {
  const { t } = useTranslation('boards')
  const updateBoard = useBoardsStore((s) => s.updateBoard)
  const deleteBoard = useBoardsStore((s) => s.deleteBoard)
  const addAttachment = useBoardsStore((s) => s.addAttachment)
  const removeAttachment = useBoardsStore((s) => s.removeAttachment)
  const folders = useBoardsStore((s) => s.folders)
  const tasks = useProjectTasksStore((s) => s.tasks)
  const addTask = useProjectTasksStore((s) => s.addTask)
  const friends = useFriendsStore((s) => s.friends)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)
  const currentUser = useAuthStore((s) => s.profile)
  const savePreset = useBoardPresetsStore((s) => s.savePreset)
  const deletePreset = useBoardPresetsStore((s) => s.deletePreset)
  const getAllPresets = useBoardPresetsStore((s) => s.getAllPresets)
  const customPresets = useBoardPresetsStore((s) => s.customPresets)
  const getLogDefault = useBoardPresetsStore((s) => s.getLogDefault)
  const setLogDefault = useBoardPresetsStore((s) => s.setLogDefault)

  const [tab, setTab] = useState<Tab>('general')
  const [title, setTitle] = useState(board.title)
  const [description, setDescription] = useState(board.description ?? '')
  const [deadline, setDeadline] = useState(board.deadline ?? '')
  const [color, setColor] = useState(board.color)
  const [internalLaunch, setInternalLaunch] = useState(board.internalLaunch ?? '')
  const [externalLaunch, setExternalLaunch] = useState(board.externalLaunch ?? '')
  const [folderId, setFolderId] = useState(board.folderId ?? '')
  const [responsibleUserId, setResponsibleUserId] = useState(board.responsibleUserId ?? '')
  const [timeBudgetHours, setTimeBudgetHours] = useState(board.timeBudgetMinutes ? String(Math.round(board.timeBudgetMinutes / 60)) : '')
  const [defaultLogMinutes, setDefaultLogMinutes] = useState(getLogDefault(board.id))
  const [attachments, setAttachments] = useState<Attachment[]>(board.attachments ?? [])
  const [presetName, setPresetName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (friends.length === 0) fetchFriends() }, [fetchFriends, friends.length])

  const tabs: { id: Tab; label: string; icon: typeof Settings }[] = [
    { id: 'general', label: t('settings.tabs.general'), icon: Settings },
    { id: 'time', label: t('settings.tabs.time'), icon: Clock },
    { id: 'dates', label: t('settings.tabs.dates'), icon: Calendar },
    { id: 'presets', label: t('settings.tabs.presets'), icon: LayoutTemplate },
    { id: 'milestones', label: t('settings.tabs.milestones'), icon: Bookmark },
  ]

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    await updateBoard(board.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      deadline: deadline || undefined,
      color,
      internalLaunch: internalLaunch || undefined,
      externalLaunch: externalLaunch || undefined,
      folderId: folderId || null,
      responsibleUserId: responsibleUserId || null,
      timeBudgetMinutes: timeBudgetHours ? Number(timeBudgetHours) * 60 : null,
    })
    setLogDefault(board.id, defaultLogMinutes)
    setSaving(false)
    onClose()
  }

  async function handleSaveAsPreset() {
    if (!presetName.trim()) return
    const boardTasks = tasks.filter((tk) => tk.boardId === board.id)
    savePreset({
      title: presetName.trim(),
      description: description.trim() || undefined,
      color,
      timeBudgetMinutes: timeBudgetHours ? Number(timeBudgetHours) * 60 : undefined,
      tasks: boardTasks.map((tk) => ({
        title: tk.title,
        columnIndex: Math.max(0, board.columns.findIndex((c) => c.id === tk.columnId)),
      })),
    })
    setPresetName('')
  }

  async function applyPreset(presetId: string) {
    const preset = getAllPresets().find((p) => p.id === presetId)
    if (!preset) return
    const existingTitles = new Set(tasks.filter((tk) => tk.boardId === board.id).map((tk) => tk.title.toLowerCase()))
    for (const tmpl of preset.tasks) {
      if (existingTitles.has(tmpl.title.toLowerCase())) continue
      const columnId = board.columns[tmpl.columnIndex]?.id ?? board.columns[0]?.id
      if (!columnId) continue
      await addTask({ title: tmpl.title, boardId: board.id, columnId })
    }
    if (preset.timeBudgetMinutes && !timeBudgetHours) {
      setTimeBudgetHours(String(Math.round(preset.timeBudgetMinutes / 60)))
    }
  }

  return (
    <Modal title={t('settings.title')} onClose={onClose} widthClass="max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 p-1 dark:border-racing-700">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === id ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <div className="flex flex-col gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('form.namePlaceholder')}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium dark:border-racing-700" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('form.descriptionPlaceholder')} rows={3}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700" />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.responsible')}</label>
              <select value={responsibleUserId} onChange={(e) => setResponsibleUserId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700">
                <option value="">{t('form.noResponsible')}</option>
                {currentUser && <option value={currentUser.id}>{currentUser.display_name} {t('form.me')}</option>}
                {friends.map((f) => <option key={f.profile.id} value={f.profile.id}>{f.profile.display_name}</option>)}
              </select>
            </div>
            {folders.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.folder')}</label>
                <select value={folderId} onChange={(e) => setFolderId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700">
                  <option value="">{t('form.noFolder')}</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.color')}</label>
              <div className="flex flex-wrap gap-2">
                {BOARD_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <AttachmentsField
              attachments={attachments}
              onUpload={async (file) => {
                const result = await addAttachment(board.id, file)
                if (result.attachment) setAttachments((prev) => [...prev, result.attachment as Attachment])
                return result
              }}
              onDelete={(attachmentId) => {
                setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
                removeAttachment(board.id, attachmentId)
              }}
            />
          </div>
        )}

        {tab === 'time' && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.timeBudget')}</label>
              <input type="number" min={0} step={1} value={timeBudgetHours} onChange={(e) => setTimeBudgetHours(e.target.value)}
                placeholder={t('form.timeBudgetPlaceholder')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('settings.defaultLogMinutes')}</label>
              <div className="flex flex-wrap gap-2">
                {TIME_PRESETS.map((m) => (
                  <button key={m} type="button" onClick={() => setDefaultLogMinutes(m)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${defaultLogMinutes === m ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-racing-800'}`}>
                    {m} min
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400">{t('settings.defaultLogHint')}</p>
            </div>
          </div>
        )}

        {tab === 'dates' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.deadline')}</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.internalLaunch')}</label>
              <input type="date" value={internalLaunch} onChange={(e) => setInternalLaunch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.externalLaunch')}</label>
              <input type="date" value={externalLaunch} onChange={(e) => setExternalLaunch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700" />
            </div>
          </div>
        )}

        {tab === 'presets' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-gray-100 p-3 dark:border-racing-800">
              <p className="mb-2 text-xs font-semibold text-gray-500">{t('settings.saveAsPreset')}</p>
              <div className="flex gap-2">
                <input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder={t('settings.presetName')}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700" />
                <button type="button" onClick={handleSaveAsPreset} disabled={!presetName.trim()}
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
                  {t('settings.savePreset')}
                </button>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500">{t('settings.applyPreset')}</p>
              <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                {getAllPresets().map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-racing-800">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-gray-400">{p.tasks.length} {t('settings.tasks')}</p>
                    </div>
                    <button type="button" onClick={() => void applyPreset(p.id)}
                      className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold hover:bg-gray-200 dark:bg-racing-800">
                      {t('settings.apply')}
                    </button>
                    {customPresets.some((c) => c.id === p.id) && (
                      <button type="button" onClick={() => deletePreset(p.id)} className="text-gray-300 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'milestones' && <BoardMilestones boardId={board.id} />}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-racing-800">
          <button type="button" disabled={saving} onClick={async () => {
            const err = await deleteBoard(board.id)
            if (err) { setError(err); return }
            onClose()
          }} className="text-sm font-medium text-red-500 hover:underline">
            {t('form.delete')}
          </button>
          <button type="button" disabled={saving} onClick={handleSave}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50">
            {saving ? t('settings.saving') : t('form.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
