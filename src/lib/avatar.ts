import { supabase } from './supabase'

const BUCKET = 'avatars'

export async function uploadAvatar(userId: string, file: File): Promise<{ url?: string; error?: string }> {
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) return { error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl }
}
