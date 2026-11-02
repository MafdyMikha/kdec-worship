import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useLang } from '../../lib/i18n.jsx'
import { useStore } from '../../store/useStore.jsx'
import { Card, Btn } from '../ui'
import { PUSH_CATEGORIES } from '../../lib/pushPolicy.js'
import { currentPushDevice, disablePush, enablePush, loadPushPreferences, pushConfigured, pushSupport, savePushPreferences, testPushDevice } from '../../lib/pushClient.js'

const TEXT = {
  title: ['Push notifications', 'الإشعارات الفورية'],
  enable: ['Enable notifications', 'تفعيل الإشعارات'], disable: ['Disable notifications on this device', 'إيقاف الإشعارات على هذا الجهاز'],
  test: ['Send test notification', 'إرسال إشعار تجريبي'], save: ['Save preferences', 'حفظ التفضيلات'], retry: ['Refresh status / retry', 'تحديث الحالة / إعادة المحاولة'],
  busy: ['Working…', 'جارٍ التنفيذ…'], enabled: ['Enabled on this device', 'مفعّلة على هذا الجهاز'], disabled: ['Not enabled on this device', 'غير مفعّلة على هذا الجهاز'],
  unknown: ['Device status could not be verified. Refresh to retry.', 'تعذر التحقق من حالة الجهاز. حدّث الحالة لإعادة المحاولة.'],
  permission: ['Browser permission', 'إذن المتصفح'], granted: ['Allowed', 'مسموح'], denied: ['Blocked', 'محظور'], default: ['Not requested', 'لم يُطلب بعد'],
  assignments: ['Service assignments', 'تكليفات الخدمة'], reminders: ['Service and rehearsal reminders (1 hour before)', 'تذكير بالخدمة والبروفة (قبل الموعد بساعة)'],
  schedule: ['Published schedule changes', 'تغييرات الجدول المنشور'], setlists: ['Published setlist updates', 'تحديثات قوائم الترانيم المنشورة'], announcements: ['Team announcements', 'إعلانات الفريق'],
  preferences: ['Account preferences apply to all your subscribed devices.', 'تُطبّق تفضيلات الحساب على جميع أجهزتك المشتركة.'],
  language: ['Notification language', 'لغة الإشعارات'], saved: ['Preferences saved.', 'تم حفظ التفضيلات.'],
  queued: ['Test queued for this device. Allow about a minute for the server scheduler. Provider acceptance does not guarantee display.', 'تمت إضافة اختبار هذا الجهاز إلى قائمة الإرسال. انتظر نحو دقيقة لتشغيل الجدولة. قبول الإرسال لا يضمن ظهور الإشعار.'],
  demo: ['Push notifications are unavailable in demo mode. No real subscriptions or messages are created.', 'الإشعارات غير متاحة في الوضع التجريبي. لا يتم إنشاء اشتراكات أو إرسال رسائل حقيقية.'],
  configuration: ['Push is not configured. An administrator must configure the public VAPID key and deploy the notification backend.', 'الإشعارات غير مُعدّة. يجب على المسؤول إعداد مفتاح VAPID العام ونشر خدمة الإشعارات.'],
  install: ['On iPhone/iPad (iOS 16.4+): use Share → Add to Home Screen, open the installed app, then tap Enable notifications.', 'على iPhone وiPad (iOS 16.4 أو أحدث): اختر مشاركة ← إضافة إلى الشاشة الرئيسية، وافتح التطبيق المثبّت، ثم اضغط تفعيل الإشعارات.'],
  insecure: ['Notifications require HTTPS or a trusted local development address.', 'تتطلب الإشعارات اتصال HTTPS أو عنوان تطوير محلي موثوقاً.'],
  unsupported: ['This browser does not support Web Push. Try an updated supported browser or installed app.', 'هذا المتصفح لا يدعم الإشعارات الفورية. جرّب متصفحاً متوافقاً ومحدّثاً أو التطبيق المثبّت.'],
  blocked: ['Notifications are blocked. Allow them in your browser or device settings, then refresh the status.', 'الإشعارات محظورة. اسمح بها من إعدادات المتصفح أو الجهاز ثم حدّث الحالة.'],
  backend: ['Could not verify or save notification settings. Check your connection and the notification migration, then retry.', 'تعذر التحقق من إعدادات الإشعارات أو حفظها. تحقق من الاتصال وإعداد قاعدة البيانات ثم أعد المحاولة.'],
  worker: ['The service worker is not ready. Use the deployed app or a production preview, apply any available app update, then reload.', 'خدمة التطبيق غير جاهزة. استخدم النسخة المنشورة أو معاينة الإنتاج، وطبّق تحديث التطبيق المتاح ثم أعد التحميل.'],
  deviceStorage: ['Device storage is unavailable. Allow site storage and retry.', 'مساحة تخزين الموقع غير متاحة. اسمح بتخزين بيانات الموقع ثم أعد المحاولة.'],
  cleanup: ['Device cleanup was incomplete. Notifications are paused locally; reconnect and retry disabling to remove the server subscription.', 'لم يكتمل إلغاء الاشتراك. تم إيقاف العرض محلياً؛ أعد الاتصال وحاول الإيقاف مجدداً لإزالة اشتراك الخادم.'],
  account: ['Your account changed. Refresh and enable notifications for the current account.', 'تم تغيير الحساب. حدّث الصفحة وفعّل الإشعارات للحساب الحالي.'],
  unsubscribe: ['Could not unsubscribe this browser. Check your connection and retry.', 'تعذر إلغاء اشتراك المتصفح. تحقق من الاتصال ثم أعد المحاولة.'],
  rateLimit: ['Wait one minute before sending another test.', 'انتظر دقيقة قبل إرسال اختبار آخر.'],
}
export default function PushSettings() {
  const { currentUser, isDemoMode } = useStore()
  const { isAr, lang } = useLang()
  const text = key => TEXT[key]?.[isAr ? 1 : 0] || TEXT.backend[isAr ? 1 : 0]
  const [state, setState] = useState({ busy: true, verified: false, device: null, preferences: null, error: '', message: '', permission: window.Notification?.permission || 'default' })
  const [refresh, setRefresh] = useState(0)
  const support = pushSupport()
  const unavailable = isDemoMode ? 'demo' : support !== 'supported' ? support : ''
  useEffect(() => {
    let active = true
    if (unavailable) return
    const load = async () => {
      try {
        const [preferences, device] = await Promise.all([loadPushPreferences(currentUser.id, lang), currentPushDevice(currentUser.id)])
        if (active) setState({ busy: false, verified: true, device, preferences, error: '', message: '', permission: Notification.permission })
      } catch (error) { if (active) setState(value => ({ ...value, busy: false, verified: false, error: error.message })) }
    }
    void load()
    return () => { active = false }
  }, [currentUser.id, lang, refresh, unavailable])
  const run = async (action, message = '') => {
    setState(value => ({ ...value, busy: true, error: '', message: '' }))
    try {
      await action()
      const device = await currentPushDevice(currentUser.id)
      setState(value => ({ ...value, device, busy: false, verified: true, permission: Notification.permission, message }))
    } catch (error) { setState(value => ({ ...value, device: null, busy: false, verified: false, permission: window.Notification?.permission || 'default', error: error.message })) }
  }
  const enable = () => {
    // Request synchronously in the click handler, before network/worker awaits.
    const permission = Notification.requestPermission()
    void run(async () => {
      await enablePush(currentUser.id, state.preferences?.language || lang, permission)
    })
  }
  return <Card className="p-5 space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
    <h2 className="flex items-center gap-2 text-xl font-display font-semibold"><Bell size={19} aria-hidden="true"/>{text('title')}</h2>
    {unavailable ? <p className="text-sm text-slate-500" role="status">{text(unavailable)}</p> : <>
      {!pushConfigured && <p className="text-sm text-amber-700" role="status">{text('configuration')}</p>}
      <div className="text-sm space-y-1" aria-live="polite">
        <p>{text('permission')}: {text(state.permission)}</p>
        <p>{state.busy ? text('busy') : text(!state.verified ? 'unknown' : state.device ? 'enabled' : 'disabled')}</p>
      </div>
      {state.permission === 'denied' && <p className="text-sm text-amber-700">{text('blocked')}</p>}
      <div className="flex flex-wrap gap-2">
        <Btn disabled={!pushConfigured || state.busy || state.permission === 'denied' || Boolean(state.device)} onClick={enable}>{text('enable')}</Btn>
        <Btn variant="secondary" disabled={state.busy} onClick={() => run(disablePush)}>{text('disable')}</Btn>
        <Btn variant="secondary" disabled={!pushConfigured || state.busy || !state.device} onClick={() => run(() => testPushDevice(state.device.id), 'queued')}>{text('test')}</Btn>
        <Btn variant="secondary" disabled={state.busy} onClick={() => { setState(value => ({ ...value, busy: true })); setRefresh(value => value + 1) }}>{text('retry')}</Btn>
      </div>
      {state.preferences && <fieldset disabled={state.busy} className="space-y-3">
        <legend className="text-sm text-slate-500 mb-2">{text('preferences')}</legend>
        {PUSH_CATEGORIES.map(category => <label key={category} className="flex items-center gap-3 min-h-11 text-sm">
          <input type="checkbox" checked={state.preferences[category]} onChange={event => setState(value => ({ ...value, preferences: { ...value.preferences, [category]: event.target.checked } }))}/>
          <span>{text(category)}</span>
        </label>)}
        <label className="flex flex-wrap items-center gap-3 text-sm">{text('language')}
          <select className="border rounded-lg p-2 bg-transparent" value={state.preferences.language} onChange={event => setState(value => ({ ...value, preferences: { ...value.preferences, language: event.target.value } }))}>
            <option value="en">English</option><option value="ar">العربية</option>
          </select>
        </label>
        <Btn onClick={() => run(() => savePushPreferences(currentUser.id, state.preferences), 'saved')}>{text('save')}</Btn>
      </fieldset>}
      {state.error && <p role="alert" className="text-sm text-red-600">{text(state.error === 'permission' ? 'blocked' : state.error)}</p>}
      {state.message && <p role="status" className="text-sm text-emerald-700">{text(state.message)}</p>}
    </>}
  </Card>
}
