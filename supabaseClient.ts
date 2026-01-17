import { createClient } from '@supabase/supabase-js'

const normalizeEnv = (v: unknown) => {
  if (typeof v !== 'string') return ''
  const trimmed = v.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

const supabaseUrl = normalizeEnv(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = normalizeEnv(import.meta.env.VITE_SUPABASE_ANON_KEY)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase env ausente: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      apikey: supabaseAnonKey,
    },
  },
})
