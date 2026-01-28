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

const parseSupabaseSessionAccessTokenFromStorage = (supabaseHost: string) => {
  try {
    const projectRef = String(supabaseHost || '').split('.')[0] || ''
    if (!projectRef) return ''
    const key = `sb-${projectRef}-auth-token`
    const raw = (globalThis as any)?.localStorage?.getItem(key)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as any
    const token =
      String(parsed?.access_token || '') ||
      String(parsed?.currentSession?.access_token || '') ||
      String(parsed?.session?.access_token || '')
    return token.trim()
  } catch {
    return ''
  }
}

const fetchWithSupabaseApiKey: typeof fetch = async (input: any, init?: any) => {
  let urlStr = ''
  try {
    if (typeof input === 'string') urlStr = input
    else if (input instanceof URL) urlStr = input.toString()
    else if (input instanceof Request) urlStr = input.url
    else if (input && typeof input.url === 'string') urlStr = input.url
  } catch {
  }

  const supabaseUrlParsed = (() => {
    try {
      return new URL(supabaseUrl)
    } catch {
      return null
    }
  })()

  const baseOrigin = supabaseUrlParsed?.origin || ''
  const baseHost = supabaseUrlParsed?.host || ''

  let resolved: URL | null = null
  try {
    resolved = urlStr ? new URL(urlStr) : null
  } catch {
    resolved = null
  }

  const isSupabaseRequest = !!(resolved && baseOrigin && resolved.origin === baseOrigin)
  const looksLikeSupabaseRequest = !!(resolved && (isSupabaseRequest || (baseHost && resolved.host === baseHost)))

  const headers = new Headers()
  try {
    if (input instanceof Request) {
      input.headers.forEach((v, k) => headers.set(k, v))
    } else if ((input as any)?.headers) {
      const inputHeaders = new Headers((input as any).headers)
      inputHeaders.forEach((v, k) => headers.set(k, v))
    }
  } catch {
  }
  if (init?.headers) {
    const extra = new Headers(init.headers)
    extra.forEach((v, k) => headers.set(k, v))
  }
  headers.set('apikey', supabaseAnonKey)
  if (looksLikeSupabaseRequest) {
    const existingAuth = String(headers.get('Authorization') || headers.get('authorization') || '').trim()
    const sessionToken = parseSupabaseSessionAccessTokenFromStorage(baseHost)
    if (sessionToken && (!existingAuth || existingAuth === `Bearer ${supabaseAnonKey}`)) {
      headers.set('Authorization', `Bearer ${sessionToken}`)
    }
  }

  let finalUrl = urlStr
  if (resolved && looksLikeSupabaseRequest) {
    const pathname = resolved.pathname || ''
    if (pathname.startsWith('/rest/v1/') && !resolved.searchParams.has('apikey')) {
      resolved.searchParams.set('apikey', supabaseAnonKey)
    }
    finalUrl = resolved.toString()
  } else if (resolved) {
    finalUrl = resolved.toString()
  }

  if (input instanceof Request) {
    const baseMethod = String(init?.method || input.method || 'GET')
    const methodUpper = baseMethod.toUpperCase()
    const body = init?.body ?? (methodUpper === 'GET' || methodUpper === 'HEAD' ? undefined : input.clone().body)
    return fetch(finalUrl, {
      ...(init || {}),
      method: baseMethod,
      body,
      headers,
      signal: init?.signal ?? input.signal,
      credentials: init?.credentials ?? input.credentials,
      cache: init?.cache ?? input.cache,
      redirect: init?.redirect ?? input.redirect,
      integrity: init?.integrity ?? input.integrity,
      keepalive: init?.keepalive ?? input.keepalive,
      mode: init?.mode ?? input.mode,
      referrer: init?.referrer ?? input.referrer,
      referrerPolicy: init?.referrerPolicy ?? input.referrerPolicy,
    })
  }

  return fetch(finalUrl, { ...(init || {}), headers })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithSupabaseApiKey,
    headers: { apikey: supabaseAnonKey },
  },
})
