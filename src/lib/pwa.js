// Browser capability checks are kept pure for dependency-free tests.
export function isStandalone(browser) {
  return Boolean(browser?.navigator?.standalone || ['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>browser?.matchMedia?.(`(display-mode: ${mode})`).matches))
}
export function installPlatform(navigator = {}) {
  const agent=navigator.userAgent||''
  if (/iPhone|iPad|iPod/i.test(agent)||(/Macintosh/i.test(agent)&&navigator.maxTouchPoints>1))return 'ios'
  if (/Android/i.test(agent))return 'android'
  return 'desktop'
}
export function isTrustedOrigin(browser) {
  return Boolean(browser?.isSecureContext&&(browser.location.protocol==='https:'||['localhost','127.0.0.1','[::1]'].includes(browser.location.hostname)))
}
export const installSteps = (platform,isAr=false) => {
  if(platform==='ios')return isAr
    ? ['افتح رابط المنصة في Safari على iPhone أو iPad.','افتح قائمة المشاركة أو قائمة المزيد ثم المشاركة، واختر «إضافة إلى الشاشة الرئيسية».','اترك «فتح كتطبيق ويب» مفعّلاً إذا ظهر، ثم اضغط «إضافة».','افتح أيقونة KDEC Worship من الشاشة الرئيسية وسجّل دخولك عند الحاجة.']
    : ['Open the website in Safari on your iPhone or iPad.','Open Share (or More, then Share) and choose “Add to Home Screen”.','Leave “Open as Web App” enabled if shown, then tap “Add”.','Open the KDEC Worship icon on your Home Screen. Sign in if requested.']
  if(platform==='android')return isAr
    ? ['افتح رابط المنصة في Chrome على Android.','من قائمة المتصفح ⋮ اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».','أكّد التثبيت، ثم افتح أيقونة KDEC Worship.']
    : ['Open the website in Chrome on Android.','In the browser’s ⋮ menu, choose “Install app” or “Add to Home screen”.','Confirm installation, then open the KDEC Worship icon.']
  return isAr
    ? ['افتح رابط المنصة في متصفح يدعم تثبيت التطبيقات مثل Chrome أو Edge.','استخدم رمز التثبيت في شريط العنوان أو خيار «تثبيت» في قائمة المتصفح.','في Safari على Mac استخدم «ملف ← إضافة إلى Dock» إذا كان متاحاً.']
    : ['Open the website in a browser that supports installation, such as Chrome or Edge.','Use the install icon in the address bar or the browser’s Install menu.','In Safari on Mac, use File → Add to Dock where available.']
}
