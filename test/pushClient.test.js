import test from 'node:test'
import { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

async function fixture(t, { demo = false } = {}) {
  const saved = new Map(['window', 'navigator', 'indexedDB', 'Notification'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  let binding = null, subscription = null, row = null, serverFailure = false, registerFailure = false
  let activeUser = '90000000-0000-4000-8000-000000000001', calls = 0, permissionRequests = 0
  const key = 'B' + 'A'.repeat(86)
  const indexedDB = { open() {
    const request = {}
    queueMicrotask(() => {
      request.result = { close() {}, transaction() {
        const tx = { objectStore() { return {
          get() { return op(binding) },
          put(value) { binding = value; return op(value) },
          delete() { binding = null; return op(null) },
        } } }
        function op(result) {
          const value = {}
          queueMicrotask(() => { value.result = result; value.onsuccess?.(); queueMicrotask(() => tx.oncomplete?.()) })
          return value
        }
        return tx
      } }
      request.onsuccess()
    })
    return request
  } }
  const reg = { active: { postMessage: (_, ports) => ports[0].postMessage({ type: 'PUSH_READY', version: 1 }) }, getNotifications: async () => [], pushManager: {
    getSubscription: async () => subscription,
    subscribe: async ({ applicationServerKey }) => {
      subscription = { endpoint: 'https://fcm.googleapis.com/send/synthetic', options: { applicationServerKey: applicationServerKey.buffer },
        toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/send/synthetic', keys: { p256dh: 'B' + 'A'.repeat(86), auth: 'B'.repeat(22) } }),
        unsubscribe: async () => { subscription = null; return true },
      }
      return subscription
    },
  } }
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: activeUser } } } }) },
    from: () => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: row, error: serverFailure ? {} : null }) }; return query },
    rpc: (name, args) => {
      calls++
      const action = async () => {
        if (serverFailure || (name === 'register_push_subscription' && registerFailure)) return { error: { message: 'Synthetic failure' } }
        if (name === 'register_push_subscription') { row = { id: '90000000-0000-4000-8000-000000000002', active: true, binding_token: args.p_binding }; return { data: row.id } }
        if (name === 'unregister_push_subscription') row = null
        return { data: null }
      }
      return { then: (...args) => action().then(...args), abortSignal() { return this } }
    },
  }
  const browser = { isSecureContext: true, Notification: { permission: 'granted', requestPermission: async () => { permissionRequests++; return 'granted' } },
    PushManager: {}, ServiceWorkerRegistration: { prototype: { showNotification() {} } }, navigator: { serviceWorker: { getRegistration: async () => reg }, userAgent: 'Synthetic desktop' }, matchMedia: () => ({ matches: false }) }
  for (const [name, value] of Object.entries({ window: browser, navigator: browser.navigator, indexedDB, Notification: browser.Notification })) Object.defineProperty(globalThis, name, { configurable: true, value })
  const slot = '__kdecPushFixture' + Math.random().toString(36).slice(2)
  globalThis[slot] = { supabase, isDemoMode: demo }
  t.after(() => { delete globalThis[slot]; for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] } })
  let code = readFileSync(new URL('../src/lib/pushClient.js', import.meta.url), 'utf8')
  code = code.replace("import { supabase, isDemoMode } from './supabase.js'", `const {supabase,isDemoMode}=globalThis['${slot}']`)
    .replace("'./pwa.js'", JSON.stringify(new URL('../src/lib/pwa.js', import.meta.url).href))
    .replace("'./pushPolicy.js'", JSON.stringify(new URL('../src/lib/pushPolicy.js', import.meta.url).href))
    .replace("import.meta.env.VITE_VAPID_PUBLIC_KEY || ''", JSON.stringify(key))
  const client = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
  return { client, browser, key, user: activeUser, binding: () => binding, row: () => row, subscription: () => subscription,
    calls: () => calls, permissionRequests: () => permissionRequests, failServer: value => { serverFailure = value }, failRegister: () => { registerFailure = true }, changeAccount: () => { activeUser = '90000000-0000-4000-8000-000000000003' } }
}
test('device enable is persisted and can be verified after reloading status', async t => {
  const f = await fixture(t)
  const device = await f.client.enablePush(f.user, 'ar', Promise.resolve('granted'))
  assert.equal(f.binding().userId, f.user)
  assert.equal((await f.client.currentPushDevice(f.user)).id, device.id)
  assert.equal(f.permissionRequests(), 0, 'permission must originate in the explicit UI click, never during load')
  await f.client.disablePush()
  assert.equal(f.subscription(), null)
  assert.equal(f.row(), null)
  assert.equal(f.binding(), null)
})
test('failed backend setup rolls back the browser subscription and binding', async t => {
  const f = await fixture(t)
  f.failRegister()
  await assert.rejects(f.client.enablePush(f.user, 'en', Promise.resolve('granted')), /backend/)
  assert.equal(f.subscription(), null)
  assert.equal(f.binding(), null)
})
test('offline disable pauses locally and keeps a receipt for successful server cleanup on retry', async t => {
  const f = await fixture(t)
  await f.client.enablePush(f.user, 'en', Promise.resolve('granted'))
  f.failServer(true)
  await assert.rejects(f.client.disablePush(), /cleanup/)
  assert.equal(f.subscription(), null)
  assert.equal(f.binding().token, null)
  assert.match(f.binding().pendingEndpoint, /synthetic/)
  f.failServer(false)
  await f.client.disablePush()
  assert.equal(f.row(), null)
  assert.equal(f.binding(), null)
})
test('account switch invalidates the former account device subscription', async t => {
  const f = await fixture(t)
  await f.client.enablePush(f.user, 'en', Promise.resolve('granted'))
  await f.client.reconcilePushAccount('another-account')
  assert.equal(f.subscription(), null)
  assert.equal(f.binding(), null)
  f.changeAccount()
  await assert.rejects(f.client.enablePush(f.user, 'en', Promise.resolve('granted')), /account/)
})
test('demo mode never subscribes, sends tests, or calls the live backend', async t => {
  const f = await fixture(t, { demo: true })
  await assert.rejects(f.client.enablePush(f.user, 'en', Promise.resolve('granted')))
  await assert.rejects(f.client.testPushDevice('fake'))
  await f.client.disablePush()
  await f.client.reconcilePushAccount(null)
  assert.equal(f.calls(), 0)
  assert.equal(f.subscription(), null)
})
test('capability detection handles insecure origins and iOS installation requirements', async t => {
  const f = await fixture(t)
  assert.equal(f.client.pushSupport(f.browser), 'supported')
  assert.equal(f.client.pushSupport({ ...f.browser, isSecureContext: false }), 'insecure')
  assert.equal(f.client.pushSupport({ ...f.browser, PushManager: undefined }), 'unsupported')
  assert.equal(f.client.pushSupport({ ...f.browser, navigator: { ...f.browser.navigator, userAgent: 'iPhone' } }), 'install')
})

test('logout while permission is pending prevents late subscription registration', async t => {
  const f = await fixture(t)
  let allow
  const permission = new Promise(resolve => { allow = resolve })
  const pending = f.client.enablePush(f.user, 'en', permission)
  await f.client.disablePush()
  allow('granted')
  await assert.rejects(pending, /account/)
  assert.equal(f.subscription(), null)
})
