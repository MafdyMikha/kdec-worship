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

if (Object.entries(environment).some(([name, value]) => value && /^VITE_.*(VAPID_PRIVATE|DISPATCH_SECRET|SERVICE_ROLE)/i.test(name))) {
  console.error('Refusing to expose a server-only notification secret through a VITE_ variable. See WEB-PUSH.md.')
  process.exit(1)
}
