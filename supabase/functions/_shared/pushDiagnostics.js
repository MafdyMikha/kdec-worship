// Never return or log raw error messages: crypto/provider errors can contain keys
// or subscription endpoints. Only these fixed categories leave the sender.
export function vapidConfiguration(values) {
  const publicKey = String(values.publicKey || '').trim()
  const privateKey = String(values.privateKey || '').trim()
  const subject = String(values.subject || '').trim()
  if (!/^[A-Za-z0-9_-]{87}=?$/.test(publicKey)) return { error: 'vapid_public_key_invalid' }
  if (!/^[A-Za-z0-9_-]{43}=?$/.test(privateKey)) return { error: 'vapid_private_key_invalid' }
  let validSubject = /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(subject)
  if (!validSubject) {
    try {
      const url = new URL(subject)
      validSubject = url.protocol === 'https:' && !url.username && !url.password && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    } catch { /* An invalid contact is a configuration error, never a network error. */ }
  }
  if (!validSubject) return { error: 'vapid_subject_invalid' }
  return { details: { publicKey, privateKey, subject } }
}
export function pushFailureReason(error, stage) {
  const message = typeof error?.message === 'string' ? error.message : ''
  if (stage === 'payload') return 'payload_invalid'
  if (stage === 'request') return ['TimeoutError', 'AbortError'].includes(error?.name) ? 'request_timeout' : 'request_network_error'
  if (/not implemented|not supported|unsupported|unimplemented/i.test(message) || error?.name === 'NotSupportedError' || (/crypto|createECDH|createSign/i.test(message) && /not a function|unavailable/i.test(message))) return 'crypto_unsupported'
  if (/subject/i.test(message)) return 'vapid_subject_invalid'
  if (/vapid/i.test(message)) return 'vapid_key_invalid'
  if (/public.?key|private.?key/i.test(message)) return 'crypto_key_invalid'
  if (/p256dh|auth secret|auth key|subscription|elliptic|ecdh|curve|derive/i.test(message)) return 'subscription_crypto_invalid'
  return 'request_build_failed'
}
