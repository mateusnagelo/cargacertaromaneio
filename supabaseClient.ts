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

const fetchWithSupabaseApiKey: typeof fetch = async (input: any, init?: any) => {
  let urlStr = ''
  try {
    if (typeof input === 'string') urlStr = input
    else if (input instanceof URL) urlStr = input.toString()
    else if (input && typeof input.url === 'string') urlStr = input.url
  } catch {
  }

  try {
    const baseOrigin = new URL(supabaseUrl).origin
    const resolved = new URL(urlStr || '', globalThis.location?.href || supabaseUrl)
    if (resolved.origin !== baseOrigin) return fetch(input, init)
  } catch {
    return fetch(input, init)
  }

  const headers = new Headers(input?.headers)
  if (init?.headers) {
    const extra = new Headers(init.headers)
    extra.forEach((v, k) => headers.set(k, v))
  }
  headers.set('apikey', supabaseAnonKey)
  if (!headers.has('Authorization') && !headers.has('authorization')) {
    headers.set('Authorization', `Bearer ${supabaseAnonKey}`)
  }

  return fetch(input, { ...(init || {}), headers })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithSupabaseApiKey,
    headers: { apikey: supabaseAnonKey },
  },
})
