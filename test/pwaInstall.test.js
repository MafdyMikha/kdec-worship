import test from 'node:test'
import assert from 'node:assert/strict'
import { createPwaController } from '../src/lib/pwaRuntime.js'
import { installPlatform, installSteps, isStandalone, isTrustedOrigin } from '../src/lib/pwa.js'
import { observePhoneViewport } from '../src/lib/phoneViewport.js'

function browserFixture() {
  const browser = new EventTarget()
  const displays = new Map()
  browser.matchMedia = query => {
    if (!displays.has(query)) displays.set(query, Object.assign(new EventTarget(), { matches: false }))
    return displays.get(query)
  }
  browser.navigator = { standalone: false, onLine: true, userAgent: 'Android' }
  browser.document = Object.assign(new EventTarget(), { readyState: 'complete' })
  browser.location = { protocol: 'https:', hostname: 'kdec.test', reload: () => {} }
  browser.isSecureContext = true
  const display = browser.matchMedia('(display-mode: standalone)')
  return { browser, display }
}
function installEvent(outcome = 'accepted', prompt = async () => {}) {
  return Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt, userChoice: Promise.resolve({ outcome }),
  })
}

test('captures a prompt before subscription and consumes it exactly once', async () => {
  const { browser } = browserFixture()
  const controller = createPwaController(browser)
  controller.start()
  let calls = 0
  const event = installEvent('accepted', async () => { calls++ })
  browser.dispatchEvent(event)
  assert.equal(event.defaultPrevented, true)
  assert.equal(controller.getSnapshot().installAvailable, true)
  let updates = 0
  const unsubscribe = controller.subscribe(() => updates++)
  await controller.install()
  await controller.install()
  assert.equal(calls, 1)
  // Acceptance alone is not evidence that OS installation finished.
  assert.equal(controller.getSnapshot().installed, false)
  assert.equal(controller.getSnapshot().installResult, 'accepted')
  browser.dispatchEvent(new Event('appinstalled'))
  assert.equal(controller.getSnapshot().installed, true)
  assert.ok(updates > 0)
  unsubscribe()
  controller.destroy()
})

test('dismissal consumes the old prompt and a new browser event permits retry', async () => {
  const { browser } = browserFixture()
  const controller = createPwaController(browser)
  controller.start()
  browser.dispatchEvent(installEvent('dismissed'))
  await controller.install()
  assert.equal(controller.getSnapshot().installResult, 'dismissed')
  assert.equal(controller.getSnapshot().installAvailable, false)
  browser.dispatchEvent(installEvent())
  await controller.install()
  assert.equal(controller.getSnapshot().installResult, 'accepted')
  controller.destroy()
})

test('rejected native prompts expose an error and permit manual installation help', async () => {
  const { browser } = browserFixture()
  const controller = createPwaController(browser)
  controller.start()
  browser.dispatchEvent(installEvent('dismissed', async () => { throw new Error('not supported') }))
  await controller.install()
  assert.equal(controller.getSnapshot().installError, true)
  assert.equal(controller.getSnapshot().installBusy, false)
  assert.equal(controller.getSnapshot().installAvailable, false)
  controller.destroy()
})

test('standalone detection covers iOS, live display-mode changes and appinstalled', () => {
  for (const kind of ['ios', 'display', 'installed']) {
    const { browser, display } = browserFixture()
    if (kind === 'ios') browser.navigator.standalone = true
    const controller = createPwaController(browser)
    controller.start()
    if (kind === 'display') { display.matches = true; display.dispatchEvent(new Event('change')) }
    if (kind === 'installed') browser.dispatchEvent(new Event('appinstalled'))
    assert.equal(controller.getSnapshot().installed, true, kind)
    controller.destroy()
  }
  assert.equal(isStandalone({}), false)
})

test('platform help includes iPad desktop UA and both English and Arabic', () => {
  assert.equal(installPlatform({ userAgent: 'iPhone' }), 'ios')
  assert.equal(installPlatform({ userAgent: 'Macintosh', maxTouchPoints: 5 }), 'ios')
  assert.equal(installPlatform({ userAgent: 'Android' }), 'android')
  assert.equal(installPlatform({ userAgent: 'Macintosh', maxTouchPoints: 0 }), 'desktop')
  for (const platform of ['ios', 'android', 'desktop']) {
    assert.ok(installSteps(platform).length >= 3)
    assert.ok(installSteps(platform, true).every(step => /[\u0600-\u06ff]/.test(step)))
  }
  assert.match(installSteps('ios').join(' '), /Open as Web App/)
  assert.match(installSteps('android').join(' '), /Chrome/)
})

test('untrusted HTTP origins do not advertise secure installation', () => {
  const { browser } = browserFixture()
  assert.equal(isTrustedOrigin(browser), true)
  browser.isSecureContext = false
  browser.location = { protocol: 'http:', hostname: '192.168.1.10' }
  assert.equal(isTrustedOrigin(browser), false)
  browser.isSecureContext = true
  browser.location.hostname = 'localhost'
  assert.equal(isTrustedOrigin(browser), true)
})

test('reconnect is reported without a forced page reload', () => {
  const { browser } = browserFixture()
  let reloads = 0
  browser.location.reload = () => { reloads++ }
  const controller = createPwaController(browser)
  controller.start()
  browser.dispatchEvent(new Event('offline'))
  assert.equal(controller.getSnapshot().online, false)
  browser.dispatchEvent(new Event('online'))
  assert.equal(controller.getSnapshot().reconnected, true)
  assert.equal(reloads, 0)
  controller.dismissReconnect()
  assert.equal(controller.getSnapshot().reconnected, false)
  controller.destroy()
})

test('phone viewport reserves keyboard space without treating pinch zoom as a keyboard', () => {
  const { browser } = browserFixture()
  browser.visualViewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 })
  const properties = new Map()
  let keyboard = false
  let editing = false
  const root = { style: { setProperty: (key, value) => properties.set(key, value) }, toggleAttribute: (_, value) => { keyboard = value } }
  browser.document = Object.assign(new EventTarget(), { documentElement: root, activeElement: { matches: () => editing } })
  browser.innerHeight = 800
  browser.requestAnimationFrame = callback => { callback(); return 1 }
  browser.cancelAnimationFrame = () => {}
  const dispose = observePhoneViewport(browser)
  assert.equal(properties.get('--app-height'), '800px')
  editing = true
  browser.visualViewport.height = 440
  browser.visualViewport.dispatchEvent(new Event('resize'))
  assert.equal(properties.get('--app-height'), '440px')
  assert.equal(keyboard, true)
  browser.visualViewport.scale = 2
  browser.visualViewport.height = 200
  browser.visualViewport.dispatchEvent(new Event('resize'))
  assert.equal(properties.get('--app-height'), '440px')
  browser.visualViewport.scale = 1
  browser.visualViewport.height = 800
  browser.visualViewport.dispatchEvent(new Event('resize'))
  assert.equal(keyboard, false)
  dispose()
})

test('worker registration bypasses HTTP cache; updates activate only after explicit action', async () => {
  const { browser } = browserFixture()
  const serviceWorker = Object.assign(new EventTarget(), { controller: {} })
  const messages = []
  const registration = Object.assign(new EventTarget(), {
    active: {}, waiting: { postMessage: message => messages.push(message) }, installing: null,
  })
  let registered
  serviceWorker.register = async (path, options) => { registered = { path, options }; return registration }
  browser.navigator.serviceWorker = serviceWorker
  let reloads = 0
  browser.location.reload = () => { reloads++ }
  const controller = createPwaController(browser, { registerWorker: true })
  controller.start()
  await Promise.resolve()
  assert.deepEqual(registered, { path: '/sw.js', options: { scope: '/', updateViaCache: 'none' } })
  assert.equal(controller.getSnapshot().updateAvailable, true)
  serviceWorker.dispatchEvent(new Event('controllerchange'))
  assert.equal(reloads, 0)
  controller.applyUpdate()
  assert.deepEqual(messages, [{ type: 'SKIP_WAITING' }])
  assert.equal(reloads, 0)
  serviceWorker.dispatchEvent(new Event('controllerchange'))
  assert.equal(reloads, 1)
  controller.destroy()
})

test('failed worker registration is recoverable without changing authentication', async () => {
  const { browser } = browserFixture()
  browser.navigator.serviceWorker = Object.assign(new EventTarget(), { register: async () => { throw new Error('network unavailable') } })
  const controller = createPwaController(browser, { registerWorker: true })
  controller.start()
  await Promise.resolve()
  assert.equal(controller.getSnapshot().workerState, 'error')
  browser.navigator.serviceWorker.register = async () => Object.assign(new EventTarget(), { active: {} })
  await controller.retryWorker()
  assert.equal(controller.getSnapshot().workerState, 'ready')
  controller.destroy()
})

test('an in-flight registration cannot attach listeners after a StrictMode cleanup', async () => {
  const { browser } = browserFixture()
  const pending = []
  browser.navigator.serviceWorker = Object.assign(new EventTarget(), { register: () => new Promise(resolve => pending.push(resolve)) })
  const controller = createPwaController(browser, { registerWorker: true })
  controller.start()
  controller.destroy()
  controller.start()
  pending[0](Object.assign(new EventTarget(), { active: {} }))
  await Promise.resolve()
  assert.equal(controller.getSnapshot().workerState, 'registering')
  pending[1](Object.assign(new EventTarget(), { active: {} }))
  await Promise.resolve()
  assert.equal(controller.getSnapshot().workerState, 'ready')
  controller.destroy()
})
