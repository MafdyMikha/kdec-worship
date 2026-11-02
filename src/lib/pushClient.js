import { supabase, isDemoMode } from './supabase.js'
import { isStandalone, installPlatform } from './pwa.js'
import { validSubscription } from './pushPolicy.js'

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
const DB_NAME = 'kdec-push-device'
let operationVersion = 0
export const pushConfigured = /^[A-Za-z0-9_-]{87}=?$/.test(publicKey)
export function pushSupport(browser = window) {
  if (!browser.isSecureContext) return 'insecure'
  if (installPlatform(browser.navigator) === 'ios' && !isStandalone(browser)) return 'install'
  return browser.Notification && browser.PushManager && browser.navigator.serviceWorker && browser.ServiceWorkerRegistration?.prototype.showNotification ? 'supported' : 'unsupported'
}
async function deviceBinding(value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('device')
    request.onerror = () => reject(new Error('deviceStorage'))
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('device', value === undefined ? 'readonly' : 'readwrite')
      const store = tx.objectStore('device')
      const op = value === undefined ? store.get('binding') : value === null ? store.delete('binding') : store.put(value, 'binding')
      let result
      op.onsuccess = () => { result = op.result }
      tx.oncomplete = () => { db.close(); resolve(result || null) }
      tx.onerror = () => { db.close(); reject(new Error('deviceStorage')) }
      tx.onabort = tx.onerror
    }
  })
}
async function registration() {
  const result = await navigator.serviceWorker.getRegistration('/')
  if (!result?.active || result.waiting) throw new Error('worker')
  // An older installed offline worker may still be active until the member
  // accepts the app update. Do not advertise push support until it responds.
  await new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const finish = error => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); error ? reject(error) : resolve() }
    const timer = setTimeout(() => finish(new Error('worker')), 1500)
    channel.port1.onmessage = event => finish(event.data?.type === 'PUSH_READY' && event.data.version === 1 ? null : new Error('worker'))
    try { result.active.postMessage({ type: 'PUSH_VERSION' }, [channel.port2]) } catch { finish(new Error('worker')) }
  })
  return result
}
function check(result) { if (result.error) throw new Error('backend'); return result.data }
export async function loadPushPreferences(userId, language) {
  if (isDemoMode || !supabase) throw new Error('demo')
  const data = check(await supabase.from('push_preferences').select('*').eq('user_id', userId).maybeSingle())
  return data || { language, assignments: true, reminders: true, schedule: true, setlists: true, announcements: true }
}
export async function savePushPreferences(userId, preferences) {
  if (isDemoMode || !supabase) throw new Error('demo')
  const row = { user_id: userId, language: preferences.language === 'ar' ? 'ar' : 'en',
    assignments: Boolean(preferences.assignments), reminders: Boolean(preferences.reminders), schedule: Boolean(preferences.schedule),
    setlists: Boolean(preferences.setlists), announcements: Boolean(preferences.announcements) }
  check(await supabase.from('push_preferences').upsert(row).select('user_id').single())
}
export async function currentPushDevice(userId) {
  if (isDemoMode || !supabase) return null
  const reg = await registration()
  const sub = await reg.pushManager.getSubscription()
  const binding = await deviceBinding()
  if (!sub || !binding || binding.userId !== userId || Notification.permission !== 'granted') return null
  const row = check(await supabase.from('push_subscriptions').select('id,binding_token,active').eq('endpoint', sub.endpoint).eq('user_id', userId).maybeSingle())
  return row?.active && row.binding_token === binding.token ? { id: row.id, endpoint: sub.endpoint } : null
}
export async function enablePush(userId, language, permissionPromise) {
  if (isDemoMode || !supabase || !pushConfigured) throw new Error('configuration')
  const version = ++operationVersion
  const assertAccount = async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error || data.session?.user.id !== userId || version !== operationVersion) throw new Error('account')
  }
  if (await permissionPromise !== 'granted') throw new Error('permission')
  await assertAccount()
  const reg = await registration()
  const old = await reg.pushManager.getSubscription()
  const previous = await deviceBinding()
  const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))
  const sameKey = old?.options?.applicationServerKey?.byteLength === bytes.length && new Uint8Array(old.options.applicationServerKey).every((byte, index) => byte === bytes[index])
  const live = old && previous?.userId === userId ? await currentPushDevice(userId) : null
  if (old && (!live || !sameKey)) {
    await deviceBinding(null)
    check(await supabase.rpc('unregister_push_subscription', { p_endpoint: old.endpoint }))
    if (!await old.unsubscribe()) throw new Error('unsubscribe')
  }
  const existing = await reg.pushManager.getSubscription()
  const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
  const token = crypto.randomUUID()
  try {
    if (!validSubscription(sub.toJSON())) throw new Error('subscription')
    await assertAccount()
    await deviceBinding({ userId, token, endpoint: sub.endpoint })
    await assertAccount()
    const id = check(await supabase.rpc('register_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: sub.toJSON().keys.p256dh,
      p_auth: sub.toJSON().keys.auth, p_binding: token, p_language: language }))
    await assertAccount()
    return { id, endpoint: sub.endpoint }
  } catch (error) {
    // Gate old/in-flight payloads before attempting server/browser cleanup.
    await Promise.allSettled([deviceBinding(null), supabase.rpc('unregister_push_subscription', { p_endpoint: sub.endpoint }).abortSignal(AbortSignal.timeout(8000)), sub.unsubscribe()])
    throw error
  }
}
export async function disablePush() {
  if (isDemoMode || !supabase || !navigator.serviceWorker) return
  // Keep a token-free cleanup receipt when offline, so a retry can remove the
  // server record even after the browser has already unsubscribed.
  operationVersion++
  let previous = null, localError = false
  try { previous = await deviceBinding() } catch { localError = true }
  let pending = { userId: previous?.userId || null, token: null, pendingEndpoint: previous?.endpoint || previous?.pendingEndpoint || null }
  try { await deviceBinding(pending) } catch { localError = true }
  const reg = await navigator.serviceWorker.getRegistration('/')
  try { (await reg?.getNotifications?.())?.forEach(notification => notification.close()) } catch { /* Subscription cleanup must still run. */ }
  const sub = await reg?.pushManager?.getSubscription()
  const endpoint = sub?.endpoint || pending.pendingEndpoint
  if (endpoint) {
    pending = { ...pending, pendingEndpoint: endpoint }
    try { await deviceBinding(pending) } catch { localError = true }
  }
  const results = await Promise.allSettled([
    endpoint ? supabase.rpc('unregister_push_subscription', { p_endpoint: endpoint }).abortSignal(AbortSignal.timeout(8000)).then(check) : Promise.resolve(),
    sub ? sub.unsubscribe().then(ok => { if (!ok) throw new Error('unsubscribe') }) : Promise.resolve(),
  ])
  if (localError && results[1].status === 'rejected') throw new Error('deviceStorage')
  if (results.some(result => result.status === 'rejected')) throw new Error('cleanup')
  await deviceBinding(null)
}
export async function reconcilePushAccount(userId) {
  if (isDemoMode || !supabase || !navigator.serviceWorker) return
  let binding
  try { binding = await deviceBinding() } catch { await disablePush(); return }
  if (!userId || (binding && (binding.userId !== userId || binding.pendingEndpoint))) await disablePush()
}
export async function testPushDevice(subscriptionId) {
  if (isDemoMode || !supabase) throw new Error('demo')
  const { error } = await supabase.rpc('queue_push_test', { p_subscription: subscriptionId })
  if (error) throw new Error(error.message?.includes('one minute') ? 'rateLimit' : 'backend')
}
