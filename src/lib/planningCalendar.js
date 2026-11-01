import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { validTolerance } from './attendancePolicy.js'
import { rehearsalBeforeService, rehearsalLocationUrl } from './rehearsal.js'

export const EVENT_TYPES = [
  { key:'youth_meeting', en:'Youth Meeting', ar:'اجتماع الشباب', color:'green', worship:true },
  { key:'service', en:'Service', ar:'خدمة', color:'blue', worship:true },
  { key:'general_meeting', en:'General Meeting', ar:'اجتماع عام', color:'orange' },
  { key:'prayer_shift', en:'House of Prayer Shift', ar:'فترة بيت الصلاة', color:'purple' },
  { key:'custom', en:'Custom event', ar:'فعالية مخصصة', color:'purple' },
  { key:'conference', en:'Conference', ar:'مؤتمر', color:'pink' },
]
export const cairoToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
export function eventKind(event) {
  if (EVENT_TYPES.some(type=>type.key===event.eventKind)) return event.eventKind
  if (event.weeklyTemplateKey==='youth' || /^(youth meeting|اجتماع الشباب)$/i.test(event.title?.trim())) return 'youth_meeting'
  if (/conference|مؤتمر/i.test(event.type)) return 'conference'
  if (/prayer|صلاة/i.test(event.type)) return 'prayer_shift'
  if (/meeting|اجتماع/i.test(event.type)) return 'general_meeting'
  return 'service'
}
export const eventType = event => { const type=EVENT_TYPES.find(type=>type.key===eventKind(event)); return type.key==='custom' && event.customCategory ? {...type,en:event.customCategory,ar:event.customCategory} : type }
export const eventStage = event => event.status==='cancelled' ? 'cancelled' : event.publishedAt || event.publishedSchedule ? 'published' : 'draft'
export const normalizePlanningFields = row => ({
  customCategory:row.custom_category ?? row.customCategory ?? '', participantIds:row.participant_ids ?? row.participantIds ?? [],
  attendanceEnabled:row.attendance_enabled ?? row.attendanceEnabled ?? true,
  lateToleranceMode:row.late_tolerance_mode ?? row.lateToleranceMode ?? 'inherit', lateToleranceMinutes:row.late_tolerance_minutes ?? row.lateToleranceMinutes ?? 0,
  eventKind:row.event_kind ?? row.eventKind, endDate:row.end_date ?? row.endDate ?? row.date,
  endTime:row.end_time ?? row.endTime ?? '', location:row.location || '', locationUrl:row.location_url ?? row.locationUrl ?? '',
  timezone:'Africa/Cairo', publishedAt:row.published_at ?? row.publishedAt ?? null,
  archivedAt:row.archived_at ?? row.archivedAt ?? null, sourceEventId:row.source_event_id ?? row.sourceEventId ?? null,
})
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value||'') && !Number.isNaN(parseISO(value).getTime()) && format(parseISO(value),'yyyy-MM-dd')===value
const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value||'')
export function validatePlanningEvent(event) {
  if (!EVENT_TYPES.some(type=>type.key===event.eventKind)) return 'Choose an event type.'
  if (event.eventKind==='custom' && (!event.customCategory?.trim() || event.customCategory.trim().length>100)) return 'Enter a custom category (1–100 characters).'
  if (!['inherit','custom','none'].includes(event.lateToleranceMode || 'inherit') || (event.lateToleranceMode==='custom' && !validTolerance(event.lateToleranceMinutes))) return 'Enter a non-negative whole number of minutes.'
  if (!event.title?.trim()) return 'Enter an event title.'
  if (!validDate(event.date)||!validDate(event.endDate)) return 'Enter valid start and end dates.'
  if (!validTime(event.time)||!validTime(event.endTime)) return 'Enter start and end times.'
  if (`${event.endDate}T${event.endTime}`<=`${event.date}T${event.time}`) return 'End must be after start. For overnight shifts choose the next day.'
  if (event.endDate!==event.date&&!['conference','prayer_shift','custom'].includes(event.eventKind)) return 'Only conferences, prayer shifts and custom events can span multiple days.'
  if (differenceInCalendarDays(parseISO(event.endDate),parseISO(event.date))>31) return 'Events may span at most 31 days.'
  if (event.locationUrl&&!rehearsalLocationUrl(event.locationUrl)) return 'Use an HTTP or HTTPS location link without login details.'
  if (event.practice?.enabled&&!rehearsalBeforeService(event.practice,event)) return 'Rehearsal must start before the event.'
  if (event.practice?.locationUrl&&!rehearsalLocationUrl(event.practice.locationUrl)) return 'Use a valid rehearsal location link.'
  if (new Set((event.team||[]).map(member=>member.personId)).size!==(event.team||[]).length) return 'Assign each member only once.'
  if ((event.team||[]).some(member=>!member.personId||!member.roleId)) return 'Choose a member and role for every assignment.'
  return ''
}
// Generate explicit recurrences as a single atomic RPC batch, retaining duration and rehearsal offset.
export function planningOccurrences(form) {
  const error=validatePlanningEvent(form)
  if(error)throw new Error(error)
  const recurrence=form.recurrence
  if(recurrence?.enabled&&(!['weekly','biweekly','monthly'].includes(recurrence.frequency)||!Number.isInteger(+recurrence.count)||+recurrence.count<2||+recurrence.count>52)) throw new Error('Choose 2–52 occurrences and a valid frequency.')
  const duration=differenceInCalendarDays(parseISO(form.endDate),parseISO(form.date))
  const rehearsalOffset=form.practice?.enabled?differenceInCalendarDays(parseISO(form.practice.date),parseISO(form.date)):0
  const groupId=recurrence?.enabled?crypto.randomUUID():null
  const rows=[]
  for(let index=0;index<(recurrence?.enabled?+recurrence.count:1);index++) {
    const date=index===0?parseISO(form.date):recurrence.frequency==='monthly'?addMonths(parseISO(form.date),index):addDays(parseISO(form.date),index*(recurrence.frequency==='biweekly'?14:7))
    const day=format(date,'yyyy-MM-dd')
    if(index&&recurrence.endDate&&day>recurrence.endDate)break
    const practice=form.practice?.enabled?{...form.practice,date:format(addDays(date,rehearsalOffset),'yyyy-MM-dd')}:form.practice||null
    rows.push({custom_category:form.eventKind==='custom'?form.customCategory.trim():'',participant_ids:form.participantIds||[],attendance_enabled:form.attendanceEnabled ?? true,late_tolerance_mode:form.lateToleranceMode||'inherit',late_tolerance_minutes:form.lateToleranceMode==='custom'?Number(form.lateToleranceMinutes):null,id:form.id||crypto.randomUUID(),event_kind:form.eventKind,title:form.title.trim(),date:day,time:form.time,end_date:format(addDays(date,duration),'yyyy-MM-dd'),end_time:form.endTime,location:form.location?.trim()||'',location_url:form.locationUrl?.trim()||'',notes:form.notes||'',practice,recurrence_group_id:groupId,recurrence_index:index,recurrence_frequency:groupId?recurrence.frequency:null,
      team:(form.team||[]).map(member=>({person_id:member.personId,worship_role_id:member.roleId}))})
  }
  if(recurrence?.enabled&&rows.length<2)throw new Error('The recurrence end date must include at least two events.')
  return rows
}
export function memberAssignmentStatus(event,userId) {
  const member=event.team?.find(member=>member.personId===userId)
  return member ? member.status||'pending' : event.declinedPersonIds?.includes(userId)?'declined':null
}
export function calendarEntries(services, start, end, {mine=false,userId,manager=false,cancelled=true}={}) {
  return services.filter(event=>!event.archivedAt&&(manager||eventStage(event)!=='draft')&&(cancelled||event.status!=='cancelled')&&(!mine||memberAssignmentStatus(event,userId)||event.participantIds?.includes(userId))).flatMap(event=>{
    const entries=[]
    if(event.date<end&&(event.endDate||event.date)>=start) entries.push({...event,calendarId:event.id,parentId:event.id,isRehearsal:false})
    if(event.practice?.enabled&&event.practice.date>=start&&event.practice.date<end) entries.push({...event,calendarId:`${event.id}:rehearsal`,parentId:event.id,isRehearsal:true,title:event.title,date:event.practice.date,endDate:event.practice.date,time:event.practice.time,endTime:'',location:event.practice.location,locationUrl:event.practice.locationUrl})
    return entries
  }).sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
}
export const entryOnDay = (entry,day) => entry.date<=day&&(entry.endDate||entry.date)>=day
export function publicationIssues(event, roles) {
  if(event.status==='cancelled'||eventStage(event)==='published')return []
  const issues=[]
  const leaders=(event.team||[]).filter(member=>roles.find(role=>role.id===member.roleId)?.scheduleLeaderRole).length
  if((eventType(event)?.worship&&leaders!==1)||leaders>1)issues.push('Assign exactly one Worship Leader.')
  if(!event.endTime)issues.push('Set an end time before publishing.')
  return issues
}

// Local demo cleanup mirrors the one-time SQL migration. Caller must persist the
// backup before applying these returned status changes.
export function cleanupDemoCalendar(services, today=cairoToday(), timestamp=new Date().toISOString(), unwantedIds=[]) {
  const affected=services.filter(event=>!event.archivedAt&&eventKind(event)!=='youth_meeting'&&['draft','scheduled'].includes(event.status)&&(event.endDate||event.date)>=today&&((event.weeklyTemplateKey&&event.weeklyTemplateKey!=='youth')||/^sv[1-4]$/.test(event.id)||unwantedIds.includes(event.id)))
  const ids=new Set(affected.map(event=>event.id))
  return {affected,services:services.map(event=>ids.has(event.id)?{...event,status:'cancelled',archivedAt:timestamp}:event)}
}

const AR_MESSAGES = {
  'Enter a custom category (1–100 characters).':'أدخل تصنيفًا مخصصًا من ١ إلى ١٠٠ حرف.',
  'Enter a non-negative whole number of minutes.':'أدخل عدد دقائق صحيحًا لا يقل عن صفر.',
  'Choose an event type.':'اختر نوع الفعالية.',
  'Enter an event title.':'أدخل عنوان الفعالية.',
  'Enter valid start and end dates.':'أدخل تاريخ بداية ونهاية صحيحين.',
  'Enter start and end times.':'أدخل وقت البداية والنهاية.',
  'End must be after start. For overnight shifts choose the next day.':'يجب أن تكون النهاية بعد البداية. للفترات الليلية اختر اليوم التالي كتاريخ انتهاء.',
  'Only conferences, prayer shifts and custom events can span multiple days.':'المؤتمرات وفترات الصلاة والفعاليات المخصصة يمكن أن تمتد لأكثر من يوم.',
  'Events may span at most 31 days.':'مدة الفعالية لا تتجاوز ٣١ يوماً.',
  'Use an HTTP or HTTPS location link without login details.':'استخدم رابط موقع HTTP أو HTTPS بدون بيانات تسجيل دخول.',
  'Rehearsal must start before the event.':'يجب أن تبدأ البروفة قبل الفعالية.',
  'Use a valid rehearsal location link.':'أدخل رابطاً صحيحاً لمكان البروفة.',
  'Assign each member only once.':'لا يمكن تكليف العضو أكثر من مرة في الفعالية نفسها.',
  'Choose a member and role for every assignment.':'اختر العضو والدور لكل تكليف.',
  'Assign exactly one Worship Leader.':'يجب تكليف قائد تسبيح واحد فقط.',
  'Set an end time before publishing.':'حدد وقت الانتهاء قبل النشر.',
  'Choose 2–52 occurrences and a valid frequency.':'اختر من ٢ إلى ٥٢ فعالية ومعدل تكرار صحيحاً.',
  'The recurrence end date must include at least two events.':'يجب أن يشمل تاريخ انتهاء التكرار فعاليتين على الأقل.',
}
export const planningMessage = (message,isAr=false) => isAr ? AR_MESSAGES[message] || message : message

// Retain legacy demo RSVP identities while using the same canonical service IDs.
export function importDemoEvents(services,events,timestamp=new Date().toISOString()) {
  const merged=[...services]
  const linked=events.map(event=>{
    const title=event.titleEn||event.title||event.title_ar||''
    let service=merged.find(row=>row.id===event.calendarServiceId||row.id===`legacy-event-${event.id}`)||merged.find(row=>row.date===event.date&&row.time===event.time&&[title,event.title,event.title_ar].filter(Boolean).some(value=>value.trim().toLowerCase()===row.title?.trim().toLowerCase()))
    if(!service){
      const kind=/^(youth meeting|اجتماع الشباب)$/i.test(title.trim())?'youth_meeting':/conference|camp|مؤتمر/i.test(event.type)?'conference':'general_meeting'
      service={id:`legacy-event-${event.id}`,title,date:event.date,time:event.time||'10:00',endDate:event.endDate||event.end_date||event.date,endTime:event.endTime||'',eventKind:kind,type:event.type,
        status:event.status==='cancelled'?'cancelled':event.status==='past'?'completed':'draft',publishedAt:event.status==='past'?(event.createdAt||event.created_at||timestamp):null,location:event.location||'',locationUrl:'',notes:[event.descriptionEn,event.description].filter(Boolean).join('\n'),team:[],setlist:[],setlistBlocks:{},practice:null}
      merged.push(service)
    }
    return {...event,calendarServiceId:service.id}
  })
  return {services:merged,events:linked}
}
