import { createClient } from '@supabase/supabase-js'
import { resolveRuntimeConfig } from './runtimeConfig.js'

const config = resolveRuntimeConfig(import.meta.env)

export const hasSupabase = config.hasSupabase
export const isDemoMode = config.isDemoMode
export const hasValidConfiguration = config.hasValidConfiguration

export const supabase = hasSupabase
  ? createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    })
  : null
