import test from 'node:test'
import assert from 'node:assert/strict'
import { vapidConfiguration, pushFailureReason } from '../supabase/functions/_shared/pushDiagnostics.js'

const valid = { publicKey: 'B' + 'A'.repeat(86), privateKey: 'A'.repeat(43), subject: 'mailto:operator@example.invalid' }
test('VAPID settings trim harmless surrounding whitespace and reject missing or quoted keys', () => {
  assert.deepEqual(vapidConfiguration({ ...valid, publicKey: ` ${valid.publicKey}\n`, privateKey: ` ${valid.privateKey}\n` }).details, valid)
  assert.equal(vapidConfiguration({ ...valid, privateKey: '' }).error, 'vapid_private_key_invalid')
  assert.equal(vapidConfiguration({ ...valid, publicKey: `"${valid.publicKey}"` }).error, 'vapid_public_key_invalid')
  assert.equal(vapidConfiguration({ ...valid, subject: 'operator@example.invalid' }).error, 'vapid_subject_invalid')
  assert.equal(vapidConfiguration({ ...valid, subject: 'https://localhost' }).error, 'vapid_subject_invalid')
  assert.equal(vapidConfiguration({ ...valid, subject: 'https://example.invalid/contact' }).error, undefined)
})
test('error categories never include arbitrary exception messages or subscription data', () => {
  assert.equal(pushFailureReason(new Error('Invalid vapid public key: sensitive-value'), 'encryption'), 'vapid_key_invalid')
  assert.equal(pushFailureReason(new Error('crypto.createECDH is not a function'), 'encryption'), 'crypto_unsupported')
  assert.equal(pushFailureReason(new Error('Public key is invalid: sensitive-value'), 'encryption'), 'crypto_key_invalid')
  assert.equal(pushFailureReason(new Error('Missing p256dh: sensitive-value'), 'encryption'), 'subscription_crypto_invalid')
  assert.equal(pushFailureReason(new Error('Unimplemented crypto API sensitive-value'), 'encryption'), 'crypto_unsupported')
  assert.equal(pushFailureReason(new Error('https://private-endpoint.invalid/token'), 'request'), 'request_network_error')
  assert.equal(pushFailureReason(new Error('secret-data'), 'payload'), 'payload_invalid')
})
