import { addDays, format, parseISO } from 'date-fns'

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

export function ensureDemoWeeklyServices(services, today = format(new Date(), 'yyyy-MM-dd')) {
  const result = [...services]
  const existing = new Set(services.map(service => `${service.weeklyTemplateKey}:${service.date}`))
  for (let offset = 0; offset < 84; offset++) {
    const date = addDays(parseISO(today), offset)
    for (const template of WEEKLY_SERVICES.filter(item => item.day === date.getDay())) {
      const dateKey = format(date, 'yyyy-MM-dd')
      if (existing.has(`${template.key}:${dateKey}`)) continue
      result.push({ id:`weekly-${template.key}-${dateKey}`, weeklyTemplateKey:template.key,
        title:template.title, date:dateKey, time:template.time, type:'Weekly Meeting',
        status:'scheduled', notes:'', team:[], setlist:[], setlistBlocks:{}, practice:null,
        soundcheckTime:null, recurrenceGroupId:null, recurrenceIndex:0 })
    }
  }
  return result
}
