import { supabase } from '@/lib/supabase'

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
const MAX_FILE_SIZE = 10 * 1024 * 1024

const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'archivo'

export async function uploadReportDocument(file: File, roleName: string): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('El documento debe ser PDF, PNG, JPG o WEBP.')
  if (file.size > MAX_FILE_SIZE) throw new Error('El documento no puede superar los 10 MB.')
  const path = `reports/${sanitize(roleName)}/${Date.now()}-${sanitize(file.name)}`
  const { error } = await supabase.storage.from('komerizo-documentos').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return supabase.storage.from('komerizo-documentos').getPublicUrl(path).data.publicUrl
}
