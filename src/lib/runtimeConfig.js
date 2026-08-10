function isAllowedUrl(value, isProduction) {
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'https:') return true
    if (!isProduction && parsed.protocol === 'http:' && ['localhost','127.0.0.1','::1'].includes(parsed.hostname)) return true
    return false
  } catch {
    return false
  }
}

const hasPlaceholder = (value) => !value || /YOUR[-_ ]|PLACEHOLDER|CHANGE[-_ ]?ME/i.test(value)

function decodeJwtPayload(value) {
  try {
    const payload = value.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')))
  } catch {
    return null
  }
}

export const isUnsafeSupabaseBrowserKey = (value='') => {
  const normalized = String(value).trim()
  if (/^sb_secret_/i.test(normalized)) return true
  const role = decodeJwtPayload(normalized)?.role
  return ['service_role','supabase_admin'].includes(role)
}

export function resolveRuntimeConfig(env) {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() || ''
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY?.trim() || ''
  const hasSupabase = Boolean(
    !hasPlaceholder(supabaseUrl) &&
    !hasPlaceholder(supabaseKey) &&
    !isUnsafeSupabaseBrowserKey(supabaseKey) &&
    isAllowedUrl(supabaseUrl, Boolean(env.PROD)),
  )
  const isDemoMode = Boolean(
    env.DEV &&
    !hasSupabase &&
    env.VITE_DEMO_MODE === 'true',
  )

  return {
    supabaseUrl,
    supabaseKey,
    hasSupabase,
    isDemoMode,
    hasValidConfiguration: hasSupabase || isDemoMode,
  }
}
