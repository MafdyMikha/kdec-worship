import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function workerFixture() {
  const handlers = {}
  const writes = []
  const deleted = []
  const offline = { publicOffline: true }
  const cache = {
    addAll: async requests => { writes.push(...requests) },
    match: async path => path === '/offline.html' ? offline : { publicAsset: path },
  }
  let network = async () => ({ privateResponse: true })
  let claimed = false
  let skipped = false
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL,
    Request: class { constructor(url, options) { Object.assign(this, { url }, options) } },
    self: {
      location: { origin: 'https://kdec.test' },
      addEventListener: (type, listener) => { handlers[type] = listener },
      skipWaiting: async () => { skipped = true },
      clients: { claim: async () => { claimed = true } },
    },
    caches: {
      open: async () => cache,
      keys: async () => ['kdec-offline-v2', 'kdec-offline-v3', 'another-app-cache'],
      delete: async key => { deleted.push(key) },
    },
    fetch: request => network(request),
  })
  return {
    writes, deleted, offline,
    failNetwork: () => { network = async () => { throw new Error('offline') } },
    async lifecycle(type) { let work; handlers[type]({ waitUntil: promise => { work = promise } }); await work },
    async fetch(path, mode = 'cors', method = 'GET') {
      let work
      handlers.fetch({ request: { url: new URL(path, 'https://kdec.test').href, mode, method }, respondWith: promise => { work = promise } })
      return work ? { intercepted: true, response: await work } : { intercepted: false }
    },
    claimed: () => claimed,
    skipped: () => skipped,
  }
}

test('installation caches only four public offline assets without credentials', async () => {
  const worker = workerFixture()
  await worker.lifecycle('install')
  assert.deepEqual(worker.writes.map(request => request.url), ['/offline.html', '/offline-retry.js', '/offline.css', '/brand/option-b-lockup.png'])
  assert.ok(worker.writes.every(request => request.credentials === 'omit' && request.cache === 'reload'))
  assert.equal(worker.skipped(), false)
})

test('activation removes only old KDEC offline caches and claims existing windows', async () => {
  const worker = workerFixture()
  await worker.lifecycle('activate')
  assert.deepEqual(worker.deleted, ['kdec-offline-v2'])
  assert.equal(worker.claimed(), true)
})

test('auth, API, private charts and non-GET requests bypass the worker', async () => {
  const worker = workerFixture()
  for (const path of ['/rest/v1/services', '/auth/v1/token', '/api/calendar', '/private/chart.pdf', 'https://example.supabase.co/rest/v1/profiles', '/offline-retry.js?token=private', '/auth/v1/token', '/assets/private.js']) {
    assert.equal((await worker.fetch(path)).intercepted, false, path)
  }
  assert.equal((await worker.fetch('/schedule', 'navigate', 'POST')).intercepted, false)
  assert.equal((await worker.fetch('/offline-retry.js', 'cors', 'POST')).intercepted, false)
  assert.equal(worker.writes.length, 0)
})

test('navigations stay network-only; offline returns generic content without saving URLs or responses', async () => {
  const worker = workerFixture()
  const online = await worker.fetch('/schedule?invite=private', 'navigate')
  assert.equal(online.response.privateResponse, true)
  assert.equal(worker.writes.length, 0)
  worker.failNetwork()
  for (const path of ['/schedule', '/services/secret', '/?code=private-auth-code']) {
    assert.equal((await worker.fetch(path, 'navigate')).response, worker.offline)
  }
  assert.equal(worker.writes.length, 0)
})

test('public offline page assets still load when disconnected', async () => {
  const worker = workerFixture()
  worker.failNetwork()
  for (const path of ['/offline-retry.js', '/offline.css', '/brand/option-b-lockup.png']) {
    assert.equal((await worker.fetch(path)).response.publicAsset, path)
  }
})

test('offline retry reloads the existing route and reports connection changes', () => {
  const listeners = {}
  const status = { textContent: '' }
  const retry = { disabled: false, textContent: '', addEventListener: (type, fn) => { listeners[type] = fn } }
  let reloads = 0
  const navigator = { onLine: false }
  vm.runInNewContext(readFileSync(new URL('../public/offline-retry.js', import.meta.url), 'utf8'), {
    navigator,
    document: { getElementById: id => id === 'retry' ? retry : status },
    window: { addEventListener: (type, fn) => { listeners[type] = fn } },
    location: { reload: () => { reloads++ } },
  })
  assert.match(status.textContent, /Waiting for a connection/)
  navigator.onLine = true
  listeners.online()
  assert.match(status.textContent, /Connection detected/)
  listeners.click()
  assert.equal(reloads, 1)
  assert.equal(retry.disabled, true)
})

test('navigating API and auth endpoints never receives a generic HTML page', async () => {
  const worker = workerFixture()
  worker.failNetwork()
  for (const path of ['/api/calendar', '/auth/v1/token', '/rest/v1/profiles', '/storage/v1/object/private', '/functions/v1/private']) {
    assert.equal((await worker.fetch(path, 'navigate')).intercepted, false)
  }
})
