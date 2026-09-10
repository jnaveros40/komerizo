import { supabase } from '@/lib/supabase'

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function uploadFinancialDocument(file: File, prefix: string): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('El documento debe ser PDF, PNG, JPG o WEBP.')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('El documento no puede superar los 10 MB.')
  }

  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')
  const path = `financial/${safePrefix}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage
    .from('komerizo-documentos')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw error
  return supabase.storage.from('komerizo-documentos').getPublicUrl(path).data.publicUrl
}
