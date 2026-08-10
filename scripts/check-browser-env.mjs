import process from 'node:process'
import { loadEnv } from 'vite'

import { isUnsafeSupabaseBrowserKey } from '../src/lib/runtimeConfig.js'

const mode = process.env.npm_lifecycle_event === 'predev' ? 'development' : 'production'
const environment = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
const browserKey = environment.VITE_SUPABASE_ANON_KEY || ''

if (isUnsafeSupabaseBrowserKey(browserKey)) {
  console.error('Refusing to bundle a Supabase server-side secret. Use only the project publishable/anon key in VITE_SUPABASE_ANON_KEY.')
  process.exit(1)
}
