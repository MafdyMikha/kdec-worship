import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function fixture() {
  const handlers = {}, shown = [], opened = [], focused = [], navigated = []
  let binding = 'device-binding', windows = []
  const context = {
    URL, indexedDB: { open() {
      const request = {}
      queueMicrotask(() => {
        request.result = { close() {}, transaction() { return { objectStore() { return { get() {
          const op = {}
          queueMicrotask(() => { op.result = { token: binding }; op.onsuccess() })
          return op
        } } } } } }
        request.onsuccess()
      })
      return request
    } },
    self: { location: { origin: 'https://kdec.test' }, addEventListener: (type, handler) => { handlers[type] = handler },
      registration: { showNotification: async (title, options) => { shown.push({ title, ...options }) } },
      clients: { matchAll: async () => windows, openWindow: async url => { opened.push(url) } },
    },
  }
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), context)
  const run = async (type, event) => { let work; handlers[type]({ ...event, waitUntil: value => { work = value } }); await work }
  return { shown, opened, focused, navigated, binding: value => { binding = value }, existingWindow: () => { windows = [{ url: 'https://kdec.test/home', navigate: async url => { navigated.push(url) }, focus: async () => { focused.push(true) } }] },
    push: payload => run('push', { data: { json: () => payload } }),
    malformed: () => run('push', { data: { json() { throw new Error('malformed') } } }),
    click: data => run('notificationclick', { notification: { data, close() {} } }),
  }
}
test('worker displays Arabic push with a matching device binding and safe icons', async () => {
  const f = fixture()
  await f.push({ binding: 'device-binding', body: 'تم تحديث الجدول', lang: 'ar', url: '/schedule', tag: 'job-1' })
  assert.equal(f.shown.length, 1)
  assert.equal(f.shown[0].dir, 'rtl')
  assert.equal(f.shown[0].icon, '/icons/kdec-worship-v5-192.png')
  assert.equal(f.shown[0].data.url, '/schedule')
})
test('logout/account switching gates queued notifications and old clicks', async () => {
  const f = fixture()
  f.binding(null)
  await f.push({ binding: 'device-binding', body: 'Old account' })
  await f.click({ binding: 'device-binding', url: '/schedule' })
  f.binding('new-account')
  await f.push({ binding: 'device-binding', body: 'Old account' })
  await f.malformed()
  assert.equal(f.shown.length, 0)
  assert.equal(f.opened.length, 0)
})
test('notification clicks reuse a same-origin window and reject external navigation', async () => {
  const f = fixture()
  await f.click({ binding: 'device-binding', url: '//evil.test' })
  assert.deepEqual(f.opened, ['https://kdec.test/'])
  f.existingWindow()
  await f.click({ binding: 'device-binding', url: '/announcements' })
  assert.deepEqual(f.navigated, ['https://kdec.test/announcements'])
  assert.equal(f.focused.length, 1)
})
