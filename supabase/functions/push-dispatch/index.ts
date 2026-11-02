import { createClient } from '@supabase/supabase-js'
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'web-push'
import { validSubscription, pushPayload } from '../_shared/pushPolicy.js'
import { vapidConfiguration, pushFailureReason } from '../_shared/pushDiagnostics.js'

// Cron only. Browser clients can queue a rate-limited own-device test through
// queue_push_test; they cannot invoke this privileged dispatcher.
Deno.serve(async (request: Request) => {
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET')
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return new Response('Push configuration missing', { status: 503 })
  const config = vapidConfiguration({ publicKey: Deno.env.get('VAPID_PUBLIC_KEY'), privateKey: Deno.env.get('VAPID_PRIVATE_KEY'), subject: Deno.env.get('VAPID_SUBJECT') })
  if (config.error) {
    console.error('Push configuration rejected', { reason: config.error })
    return Response.json({ error: config.error }, { status: 503 })
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  let processed = 0
  try {
    const { data: jobs, error } = await db.rpc('claim_push_jobs', { p_limit: 20 })
    if (error) throw new Error('claim failed')
    // At most 20 x 5 seconds, below the database's five-minute lease.
    for (const claim of jobs || []) {
      const { data: job, error: prepareError } = await db.rpc('prepare_push_delivery', { p_job: claim.id, p_lease: claim.lease_token })
      if (prepareError) throw new Error('prepare failed')
      if (!job) continue
      let status = 0
      let stage = 'payload'
      try {
        const subscription = { endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth } }
        if (!validSubscription(subscription)) status = 400
        else {
          const ttl = Math.max(0, Math.min(3600, Math.floor((Date.parse(job.expires_at) - Date.now()) / 1000)))
          // Use generated encrypted request bytes with fetch so redirects are
          // explicitly rejected; never follow a push endpoint to a private host.
          const payload = JSON.stringify(pushPayload(job))
          stage = 'encryption'
          const details = webpush.generateRequestDetails(subscription, payload, {
            vapidDetails: config.details, TTL: ttl, contentEncoding: 'aes128gcm',
          })
          stage = 'request'
          const response = await fetch(subscription.endpoint, { method: 'POST', headers: details.headers,
            body: details.body ? new Uint8Array(details.body) : undefined, redirect: 'error', signal: AbortSignal.timeout(5000) })
          status = response.status
          // Cleanup failures must never turn provider acceptance into a retry.
          try { await response.body?.cancel() } catch { /* HTTP status remains authoritative. */ }
          if (status >= 400) console.warn('Push provider rejected delivery', { job_id: job.id, status })
        }
      } catch (error) {
        console.error('Push delivery failed', { job_id: job.id, stage, reason: pushFailureReason(error, stage) })
        // Transient transport failures retry; local construction failures also
        // stay bounded. Existing database status semantics remain compatible.
        status = 0
      }
      const { error: finishError } = await db.rpc('finish_push_job', { p_job: claim.id, p_lease: claim.lease_token, p_status: status })
      if (finishError) throw new Error('finish failed')
      processed++
    }
    return Response.json({ processed })
  } catch {
    console.error('Push dispatch database operation failed; leased work will retry.')
    return Response.json({ error: 'Dispatch failed', processed }, { status: 500 })
  }
})
