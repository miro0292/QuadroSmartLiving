import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function isPlaceholderValue(value) {
  const normalized = String(value || '').trim().toUpperCase()
  return (
    normalized.includes('TU-PROYECTO') ||
    normalized.includes('TU_SUPABASE_ANON_KEY') ||
    normalized === ''
  )
}

export const hasSupabaseConfig =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  !isPlaceholderValue(supabaseUrl) &&
  !isPlaceholderValue(supabaseAnonKey)

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
