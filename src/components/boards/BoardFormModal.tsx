import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../layout/Modal'
import AttachmentsField from '../shared/AttachmentsField'
import { useBoardsStore, BOARD_COLORS } from '../../store/boardsStore'
import { useFriendsStore } from '../../store/friendsStore'
import { useAuthStore } from '../../store/authStore'
import type { Attachment, Board } from '../../types'
import { BOARD_TEMPLATES } from '../../lib/boardTemplates'

interface BoardFormModalProps {
  board?: Board
  onClose: () => void
}

export default function BoardFormModal({ board, onClose }: BoardFormModalProps) {
  const { t } = useTranslation('boards')
  const addBoard = useBoardsStore((s) => s.addBoard)
  const createFromTemplate = useBoardsStore((s) => s.createFromTemplate)
  const updateBoard = useBoardsStore((s) => s.updateBoard)
  const deleteBoard = useBoardsStore((s) => s.deleteBoard)
  const addAttachment = useBoardsStore((s) => s.addAttachment)
  const removeAttachment = useBoardsStore((s) => s.removeAttachment)
  const folders = useBoardsStore((s) => s.folders)
  const friends = useFriendsStore((s) => s.friends)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)
  const currentUser = useAuthStore((s) => s.profile)

  useEffect(() => { if (friends.length === 0) fetchFriends() }, []) // eslint-disable-line

  const [title, setTitle] = useState(board?.title ?? '')
  const [description, setDescription] = useState(board?.description ?? '')
  const [deadline, setDeadline] = useState(board?.deadline ?? '')
  const [color, setColor] = useState(board?.color ?? BOARD_COLORS[0])
  const [internalLaunch, setInternalLaunch] = useState(board?.internalLaunch ?? '')
  const [externalLaunch, setExternalLaunch] = useState(board?.externalLaunch ?? '')
  const [folderId, setFolderId] = useState(board?.folderId ?? '')
  const [responsibleUserId, setResponsibleUserId] = useState(board?.responsibleUserId ?? '')
  const [timeBudgetHours, setTimeBudgetHours] = useState(board?.timeBudgetMinutes ? String(Math.round(board.timeBudgetMinutes / 60)) : '')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>(board?.attachments ?? [])
  const [templateId, setTemplateId] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    if (board) {
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
    } else if (templateId) {
      await createFromTemplate(templateId, title.trim())
    } else {
      await addBoard({
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadline || undefined,
        color,
        internalLaunch: internalLaunch || undefined,
        externalLaunch: externalLaunch || undefined,
        folderId: folderId || null,
        responsibleUserId: responsibleUserId || null,
      })
    }
    onClose()
  }

  return (
    <Modal title={board ? t('form.editProject') : t('form.newProject')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('form.namePlaceholder')}
          className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-medium focus:border-accent focus:outline-none dark:border-racing-700"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('form.descriptionPlaceholder')}
          rows={2}
          className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
        />

        {!board && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.template')}</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm dark:border-racing-700">
              <option value="">{t('form.noTemplate')}</option>
              {BOARD_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>{tmpl.title}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.responsible')}</label>
          <select
            value={responsibleUserId}
            onChange={(e) => setResponsibleUserId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          >
            <option value="">{t('form.noResponsible')}</option>
            {currentUser && (
              <option value={currentUser.id}>{currentUser.display_name} {t('form.me')}</option>
            )}
            {friends.map((f) => (
              <option key={f.profile.id} value={f.profile.id}>{f.profile.display_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.deadline')}</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
          </div>
          {folders.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.folder')}</label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              >
                <option value="">{t('form.noFolder')}</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.timeBudget')}</label>
          <input
            type="number"
            min={0}
            step={1}
            value={timeBudgetHours}
            onChange={(e) => setTimeBudgetHours(e.target.value)}
            placeholder={t('form.timeBudgetPlaceholder')}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.color')}</label>
          <div className="flex flex-wrap gap-2">
            {BOARD_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.internalLaunch')}</label>
            <input
              type="date"
              value={internalLaunch}
              onChange={(e) => setInternalLaunch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('form.externalLaunch')}</label>
            <input
              type="date"
              value={externalLaunch}
              onChange={(e) => setExternalLaunch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
          </div>
        </div>

        {board && (
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
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="mt-2 flex items-center justify-between">
          {board ? (
            <button
              type="button"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true)
                setError(null)
                const err = await deleteBoard(board.id)
                setDeleting(false)
                if (err) {
                  setError(err)
                  return
                }
                onClose()
              }}
              className="text-sm font-medium text-red-500 hover:underline disabled:opacity-60"
            >
              {t('form.delete')}
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
          >
            {board ? t('form.save') : t('form.create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
