import { supabase } from './supabase'
import type { Attachment } from '../types'

const BUCKET = 'attachments'

export async function uploadAttachment(folder: string, file: File): Promise<{ attachment?: Attachment; error?: string }> {
  const path = `${folder}/${crypto.randomUUID()}-${file.name}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) return { error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return {
    attachment: {
      id: crypto.randomUUID(),
      name: file.name,
      url: data.publicUrl,
      path,
      size: file.size,
      createdAt: new Date().toISOString(),
    },
  }
}

export async function deleteAttachment(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
