export const PUSH_CATEGORIES = ['assignments', 'reminders', 'schedule', 'setlists', 'announcements']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function validPushEndpoint(value) {
  try {
    if (typeof value !== 'string' || value.length > 2048) return false
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash &&
      (['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname) ||
        /^[a-z0-9-]+\.push\.apple\.com$/.test(url.hostname)) && url.pathname.length > 1
  } catch { return false }
}
export function validSubscription(value) {
  return Boolean(validPushEndpoint(value?.endpoint) && /^[A-Za-z0-9_-]{87}=?$/.test(value?.keys?.p256dh || '') && /^[A-Za-z0-9_-]{22}={0,2}$/.test(value?.keys?.auth || ''))
}
export function safePushPath(value) {
  return typeof value === 'string' && (/^\/services\/[0-9a-f-]{36}$/i.test(value) || ['/settings', '/schedule', '/announcements'].includes(value)) ? value : '/'
}
export function pushPayload(job) {
  if ((!PUSH_CATEGORIES.includes(job.category) && job.category !== 'test') || !UUID.test(job.binding_token) || !UUID.test(job.id)) throw new Error('Invalid push job')
  const ar = job.language === 'ar'
  const messages = ar ? {
    assignments: 'لديك تحديث في تكليفات الخدمة. افتح التطبيق للمراجعة.',
    reminders: 'لديك موعد خدمة أو بروفة قريب. افتح التطبيق للتفاصيل.',
    schedule: 'تم تحديث جدول الفريق. افتح التطبيق للمراجعة.',
    setlists: 'تم تحديث قائمة الترانيم. افتح التطبيق للمراجعة.',
    announcements: 'يوجد إعلان جديد للفريق. افتح التطبيق للمراجعة.',
    test: 'تم إرسال الإشعار التجريبي بنجاح.',
  } : {
    assignments: 'Your service assignments have an update. Open the app to review.',
    reminders: 'A service or rehearsal is coming up. Open the app for details.',
    schedule: 'The team schedule has an update. Open the app to review.',
    setlists: 'A setlist has been updated. Open the app to review.',
    announcements: 'There is a new team announcement. Open the app to review.',
    test: 'Your test notification was sent successfully.',
  }
  return { title: 'KDEC Worship', body: messages[job.category], lang: ar ? 'ar' : 'en', dir: ar ? 'rtl' : 'ltr',
    binding: job.binding_token, tag: job.id, url: safePushPath(job.service_id ? `/services/${job.service_id}` : job.category === 'announcements' ? '/announcements' : '/settings') }
}
