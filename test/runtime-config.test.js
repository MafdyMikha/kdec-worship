import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveRuntimeConfig } from '../src/lib/runtimeConfig.js'

const LIVE_ENV = {
  VITE_SUPABASE_URL: 'https://kdec-example.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_example',
}

test('valid credentials select the live backend', () => {
  const config = resolveRuntimeConfig({ ...LIVE_ENV, DEV: true, VITE_DEMO_MODE: 'false' })

  assert.equal(config.hasSupabase, true)
  assert.equal(config.isDemoMode, false)
  assert.equal(config.hasValidConfiguration, true)
})

test('missing credentials fail closed instead of falling back to demo data', () => {
  const config = resolveRuntimeConfig({ DEV: true })

  assert.equal(config.hasSupabase, false)
  assert.equal(config.isDemoMode, false)
  assert.equal(config.hasValidConfiguration, false)
})

test('placeholder and malformed credentials are rejected', () => {
  assert.equal(resolveRuntimeConfig({ ...LIVE_ENV, VITE_SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co', DEV: true }).hasSupabase, false)
  assert.equal(resolveRuntimeConfig({ ...LIVE_ENV, VITE_SUPABASE_ANON_KEY: 'YOUR-PUBLIC-ANON-KEY', DEV: true }).hasSupabase, false)
  assert.equal(resolveRuntimeConfig({ ...LIVE_ENV, VITE_SUPABASE_URL: 'not-a-url', DEV: true }).hasSupabase, false)
})

test('production requires TLS and rejects server-side secrets', () => {
  const serviceRolePayload = btoa(JSON.stringify({ role:'service_role' }))
  const serviceRoleJwt = `header.${serviceRolePayload}.signature`

  assert.equal(resolveRuntimeConfig({ ...LIVE_ENV, VITE_SUPABASE_URL:'http://example.com', PROD:true }).hasSupabase, false)
  assert.equal(resolveRuntimeConfig({ ...LIVE_ENV, VITE_SUPABASE_ANON_KEY:'sb_secret_do-not-ship', PROD:true }).hasSupabase, false)
  assert.equal(resolveRuntimeConfig({ ...LIVE_ENV, VITE_SUPABASE_ANON_KEY:'  sb_secret_do-not-ship  ', PROD:true }).hasSupabase, false)
  assert.equal(resolveRuntimeConfig({ ...LIVE_ENV, VITE_SUPABASE_ANON_KEY:serviceRoleJwt, PROD:true }).hasSupabase, false)
})

test('local self-hosted development may use loopback HTTP', () => {
  const config = resolveRuntimeConfig({ ...LIVE_ENV, VITE_SUPABASE_URL:'http://127.0.0.1:54321', DEV:true })
  assert.equal(config.hasSupabase, true)
})

test('demo data requires an explicit local-development opt-in', () => {
  const localDemo = resolveRuntimeConfig({ DEV: true, VITE_DEMO_MODE: 'true' })
  const production = resolveRuntimeConfig({ DEV: false, PROD: true, VITE_DEMO_MODE: 'true' })

  assert.equal(localDemo.isDemoMode, true)
  assert.equal(localDemo.hasValidConfiguration, true)
  assert.equal(production.isDemoMode, false)
  assert.equal(production.hasValidConfiguration, false)
})

test('live credentials always take precedence over a stale demo flag', () => {
  const config = resolveRuntimeConfig({ ...LIVE_ENV, DEV: true, VITE_DEMO_MODE: 'true' })

  assert.equal(config.hasSupabase, true)
  assert.equal(config.isDemoMode, false)
})
