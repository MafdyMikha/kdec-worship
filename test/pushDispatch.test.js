import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'

async function fixture(t, { authorized = true, configured = true, revoked = false, invalidEndpoint = false, status = 201, buildError = null, requestError = null, cancelError = false, invalidConfig = false } = {}) {
  let handler, finished, requestOptions, encryptionOptions, providerCalls = 0, claims = 0
  const logs = []
  const originalError = console.error
  const originalWarn = console.warn
  console.error = (...args) => logs.push(args)
  console.warn = (...args) => logs.push(args)
  const descriptors = new Map(['Deno', 'fetch'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  const slot = '__pushDispatchFixture' + Math.random().toString(36).slice(2)
  const job = { id: '90000000-0000-4000-8000-000000000001', binding_token: '90000000-0000-4000-8000-000000000002', category: 'test', language: 'en', attempts: 1,
    endpoint: invalidEndpoint ? 'https://127.0.0.1/private' : 'https://fcm.googleapis.com/send/synthetic', p256dh: 'B' + 'A'.repeat(86), auth: 'B'.repeat(22), expires_at: new Date(Date.now() + 60000).toISOString() }
  globalThis[slot] = {
    createClient: () => ({ rpc: async (name, args) => {
      if (name === 'claim_push_jobs') { claims++; return { data: [{ id: job.id, lease_token: 'lease' }] } }
      if (name === 'prepare_push_delivery') return { data: revoked ? null : job }
      if (name === 'finish_push_job') { finished = args; return {} }
    } }),
    webpush: { generateRequestDetails: (sub, payload, options) => { encryptionOptions = options; if (buildError) throw buildError; assert.equal(JSON.parse(payload).binding, job.binding_token); return { body: new Uint8Array([1, 2, 3]), headers: {} } } },
  }
  const environment = { PUSH_DISPATCH_SECRET: 'test-secret', SUPABASE_URL: 'https://edge.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server-key',
    VAPID_PUBLIC_KEY: 'B' + 'A'.repeat(86), VAPID_PRIVATE_KEY: invalidConfig ? 'incorrect-key' : 'A'.repeat(43), VAPID_SUBJECT: 'mailto:operator@example.invalid' }
  globalThis.Deno = { env: { get: name => name === 'PUSH_DISPATCH_SECRET' || configured ? environment[name] : undefined }, serve: fn => { handler = fn } }
  globalThis.fetch = async (url, options) => { providerCalls++; requestOptions = options; if (requestError) throw requestError; return { status, body: { cancel: async () => { if (cancelError) throw new Error('Synthetic cleanup failure') } } } }
  t.after(() => { console.error = originalError; console.warn = originalWarn; delete globalThis[slot]; for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] } })
  let source = readFileSync(new URL('../supabase/functions/push-dispatch/index.ts', import.meta.url), 'utf8')
    .replace("import { createClient } from '@supabase/supabase-js'", `const {createClient}=globalThis['${slot}']`)
    .replace("import webpush from 'web-push'", `const {webpush}=globalThis['${slot}']`)
    .replace("'../_shared/pushPolicy.js'", JSON.stringify(new URL('../supabase/functions/_shared/pushPolicy.js', import.meta.url).href))
    .replace("'../_shared/pushDiagnostics.js'", JSON.stringify(new URL('../supabase/functions/_shared/pushDiagnostics.js', import.meta.url).href))
    .replace('(request: Request)', '(request)')
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
  return { send: method => handler(new Request('https://edge.example.invalid/push-dispatch', { method: method || 'POST', headers: authorized ? { Authorization: 'Bearer test-secret' } : {} })),
    logs: () => logs, calls: () => providerCalls, claims: () => claims, finished: () => finished, requestOptions: () => requestOptions, encryptionOptions: () => encryptionOptions }
}
test('dispatcher refuses public callers and fails closed without server configuration', async t => {
  const unauthorized = await fixture(t, { authorized: false })
  assert.equal((await unauthorized.send()).status, 401)
  assert.equal(unauthorized.claims(), 0)
})
test('dispatcher missing configuration never claims or sends work', async t => {
  const f = await fixture(t, { configured: false })
  assert.equal((await f.send()).status, 503)
  assert.equal(f.claims(), 0)
})
test('dispatcher rechecks eligibility, encrypts delivery and refuses redirects', async t => {
  const f = await fixture(t)
  assert.equal((await f.send()).status, 200)
  assert.equal(f.calls(), 1)
  assert.equal(f.encryptionOptions().contentEncoding, 'aes128gcm')
  assert.ok(f.encryptionOptions().TTL <= 60)
  assert.equal(f.requestOptions().redirect, 'error')
  assert.equal(f.finished().p_status, 201)
})
test('revoked eligibility skips delivery after claiming', async t => {
  const f = await fixture(t, { revoked: true })
  await f.send()
  assert.equal(f.calls(), 0)
})
test('a corrupt or spoofed stored endpoint never receives an HTTP request', async t => {
  const f = await fixture(t, { invalidEndpoint: true })
  await f.send()
  assert.equal(f.calls(), 0)
  assert.equal(f.finished().p_status, 400)
})

test('invalid VAPID configuration reports a safe reason without consuming queued jobs', async t => {
  const f = await fixture(t, { invalidConfig: true })
  const response = await f.send()
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'vapid_private_key_invalid' })
  assert.equal(f.claims(), 0)
  assert.equal(JSON.stringify(f.logs()).includes('incorrect-key'), false)
})
test('crypto failures identify their stage without logging the exception or key', async t => {
  const f = await fixture(t, { buildError: new Error('ECDH is not implemented; sensitive-key-value') })
  await f.send()
  assert.equal(f.finished().p_status, 0)
  assert.equal(f.calls(), 0)
  const output = JSON.stringify(f.logs())
  assert.match(output, /crypto_unsupported/)
  assert.match(output, /encryption/)
  assert.equal(output.includes('sensitive-key-value'), false)
})
test('transport timeouts are distinguishable from request construction failures', async t => {
  const error = new Error('Private endpoint should never be logged')
  error.name = 'TimeoutError'
  const f = await fixture(t, { requestError: error })
  await f.send()
  assert.equal(f.finished().p_status, 0)
  assert.match(JSON.stringify(f.logs()), /request_timeout/)
  assert.equal(JSON.stringify(f.logs()).includes('Private endpoint'), false)
})
test('response cleanup failure preserves successful provider acceptance', async t => {
  const f = await fixture(t, { cancelError: true })
  await f.send()
  assert.equal(f.finished().p_status, 201)
  assert.equal(f.logs().length, 0)
})
