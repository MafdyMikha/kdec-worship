import test from 'node:test'
import assert from 'node:assert/strict'
import { validPushEndpoint, validSubscription, pushPayload, safePushPath } from '../src/lib/pushPolicy.js'

test('push endpoints allow known providers and reject SSRF and host spoofing', () => {
  for (const endpoint of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://web.push.apple.com/abc']) assert.equal(validPushEndpoint(endpoint), true)
  for (const endpoint of ['http://fcm.googleapis.com/send', 'https://127.0.0.1/private', 'https://fcm.googleapis.com.evil.test/send', 'https://evil@fcm.googleapis.com/send', 'https://fcm.googleapis.com:8080/send', 'https://fcm.googleapis.com/send#fragment', 'https://push.example.invalid/send', null]) assert.equal(validPushEndpoint(endpoint), false, endpoint)
  assert.equal(validSubscription({ endpoint: 'https://fcm.googleapis.com/send', keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) } }), true)
  assert.equal(validSubscription({ endpoint: 'https://fcm.googleapis.com/send', keys: { p256dh: 'invalid', auth: 'invalid' } }), false)
})

test('notification payloads are localized and omit private source content', () => {
  const base = { id: '90000000-0000-4000-8000-000000000001', binding_token: '90000000-0000-4000-8000-000000000002', service_id: '90000000-0000-4000-8000-000000000003', category: 'reminders', title: 'Private name', notes: 'Private notes' }
  const ar = pushPayload({ ...base, language: 'ar' })
  assert.equal(ar.dir, 'rtl')
  assert.match(ar.body, /بروفة/)
  assert.equal(ar.url, `/services/${base.service_id}`)
  assert.equal(JSON.stringify(ar).includes('Private'), false)
  assert.equal(pushPayload({ ...base, language: 'en' }).dir, 'ltr')
  assert.throws(() => pushPayload({ ...base, category: 'arbitrary' }))
  assert.throws(() => pushPayload({ ...base, binding_token: '' }))
})

test('notification navigation allows only known internal routes', () => {
  for (const path of ['https://evil.test', '//evil.test', '/auth/callback?token=secret', '/settings?next=https://evil.test', '/services/../settings', 'javascript:alert(1)']) assert.equal(safePushPath(path), '/')
  assert.equal(safePushPath('/announcements'), '/announcements')
})
