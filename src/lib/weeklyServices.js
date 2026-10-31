import { format, parseISO } from 'date-fns'

export const WEEKLY_SERVICES = [
  { key:'youth', title:'Youth Meeting', titleAr:'اجتماع الشباب', day:5, time:'18:00' },
  { key:'prayer', title:'Prayer Meeting', titleAr:'اجتماع الصلاة', day:2, time:'19:00' },
  { key:'friday-morning', title:'Friday Morning Meeting', titleAr:'اجتماع الجمعة الصباحي', day:5, time:'11:00' },
  { key:'house', title:'House Meeting', titleAr:'اجتماع البيت', day:5, time:'14:00' },
]

export function weeklyServiceTitle(service, isAr) {
  const template = WEEKLY_SERVICES.find(item => item.key === service.weeklyTemplateKey)
  return template ? (isAr ? template.titleAr : template.title) : service.title
}

// Compatibility only: loading data must never create predefined meetings.
export function ensureDemoWeeklyServices(services) { return [...services] }

export function isYouthMeetingDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parseISO(date).getTime())
    && format(parseISO(date), 'yyyy-MM-dd') === date && parseISO(date).getDay() === 5
}
