import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, Plus, Trash2 } from 'lucide-react'
import type { Attachment } from '../../types'
import { formatFileSize } from '../../lib/attachments'

interface AttachmentsFieldProps {
  attachments: Attachment[]
  onUpload: (file: File) => Promise<{ attachment?: Attachment; error?: string }>
  onDelete: (attachmentId: string) => void
}

export default function AttachmentsField({ attachments, onUpload, onDelete }: AttachmentsFieldProps) {
  const { t } = useTranslation('common')
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    for (const file of Array.from(files)) {
      const result = await onUpload(file)
      if (result.error) setError(result.error)
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{t('attachments.label')}</label>
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-col gap-1">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-racing-700"
            >
              <Paperclip size={14} className="flex-shrink-0 text-gray-400" />
              <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                {a.name}
              </a>
              <span className="flex-shrink-0 text-xs text-gray-400">{formatFileSize(a.size)}</span>
              <button type="button" onClick={() => onDelete(a.id)} className="flex-shrink-0 text-gray-300 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-60 dark:bg-racing-800 dark:text-racing-100">
        <Plus size={14} />
        {uploading ? t('attachments.uploading') : t('attachments.attachFile')}
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={uploading}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
