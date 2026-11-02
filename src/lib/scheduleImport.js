import { EVENT_TYPES, validatePlanningEvent } from './planningCalendar.js'
import { searchText } from './ministry.js'
import { time24, timeParts } from './time.js'

export const SCHEDULE_COLUMNS = ['title','date','start_time','end_date','end_time','event_kind','subcategory','custom_category','member','role','location','notes']
export const SCHEDULE_COLUMN_LABELS={title:['Event title','عنوان الفعالية'],date:['Date','التاريخ'],start_time:['Start time','البداية'],end_date:['End date','تاريخ الانتهاء'],end_time:['End time','النهاية'],event_kind:['Event type','نوع الفعالية'],subcategory:['Subcategory','التصنيف الفرعي'],custom_category:['Custom category','التصنيف المخصص'],member:['Member','العضو'],role:['Role','الدور'],location:['Location','المكان'],notes:['Notes','ملاحظات']}
export const SCHEDULE_TEMPLATE = '\uFEFF'+SCHEDULE_COLUMNS.join(',')+'\r\nYouth Meeting,2026-11-06,6:00 PM,2026-11-06,8:00 PM,youth_meeting,Evening,,,,Main hall,\r\n'
export function importTime(value) {
  if(typeof value==='number'&&value>=0&&value<1){const minutes=Math.round(value*1440);return minutes<1440?`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`:''}
  if(value instanceof Date)return `${String(value.getUTCHours()).padStart(2,'0')}:${String(value.getUTCMinutes()).padStart(2,'0')}`
  const text=String(value??'').trim()
  const match=/^(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)$/i.exec(text)
  if(match)return time24(String(Number(match[1])),match[2],match[3].toUpperCase())
  const parts=timeParts(text)
  return parts?time24(parts.hour,parts.minute,parts.period):''
}
const importDate=value=>value instanceof Date?value.toISOString().slice(0,10):String(value??'').trim()
export function suggestScheduleMapping(headers) {
  const aliases={title:['title','event','service','العنوان'],date:['date','التاريخ'],start_time:['start time','time','البداية'],end_date:['end date','تاريخ الانتهاء'],end_time:['end time','النهاية'],event_kind:['event kind','type','نوع الفعالية'],subcategory:['subcategory','التصنيف الفرعي'],custom_category:['custom category','التصنيف المخصص'],member:['member','email','name','العضو'],role:['role','instrument','الدور'],location:['location','المكان'],notes:['notes','ملاحظات']}
  return Object.fromEntries(SCHEDULE_COLUMNS.map(key=>[key,headers.findIndex(header=>[key.replaceAll('_',' '),...(aliases[key]||[])].includes(searchText(String(header).replaceAll('_',' '))))]))
}
export function previewSchedule(table,mapping,{people=[],roles=[],services=[],resolutions={}}={}) {
  const events=new Map(),rows=[]
  for(const [index,source] of table.slice(1).entries()){
    if(!source.some(cell=>String(cell??'').trim()))continue
    const line=index+2,get=key=>mapping[key]>=0?source[mapping[key]]:'',title=String(get('title')||'').trim()
    const date=importDate(get('date')),time=importTime(get('start_time')),endTime=importTime(get('end_time')),endDate=importDate(get('end_date'))||date
    const eventKind=String(get('event_kind')||'service').trim(),customCategory=String(get('custom_category')||'').trim(),subcategory=String(get('subcategory')||'').trim()
    const event={title,date,time,endDate,endTime,eventKind,customCategory,subcategory,location:String(get('location')||'').trim(),notes:String(get('notes')||'').trim(),team:[],lateToleranceMode:'inherit'}
    const errors=[],invalid=validatePlanningEvent(event)
    if(invalid)errors.push(invalid)
    if(!EVENT_TYPES.some(type=>type.key===eventKind))errors.push('Choose a supported event_kind.')
    if(services.some(service=>service.date===date&&service.time===time&&searchText(service.title)===searchText(title)))errors.push('Event already exists. Existing schedules are never overwritten.')
    const memberText=String(get('member')||'').trim(),roleText=String(get('role')||'').trim()
    const matches=people.filter(person=>person.id===memberText||searchText(person.email)===searchText(memberText)&&person.email||searchText(person.name)===searchText(memberText))
    const person=resolutions[line]?people.find(person=>person.id===resolutions[line]):matches.length===1?matches[0]:null
    const role=roles.find(role=>role.active&&(role.id===roleText||searchText(role.name)===searchText(roleText)))
    if(memberText||roleText){
      if(!person)errors.push(matches.length>1?'Ambiguous member. Select the correct person.':'Member not found.')
      else if(person.status!=='active'||['inactive','leave','archived'].includes(person.servingStatus))errors.push('Member is unavailable for assignments.')
      if(!role)errors.push('Active serving role not found.')
      else if(person&&!person.roleIds?.includes(role.id))errors.push('Role is not assigned to this member.')
      if(person&&role)event.team.push({personId:person.id,roleId:role.id,role:role.name})
    }
    const key=`${date}|${time}|${searchText(title)}`
    const prior=events.get(key)
    if(prior){
      if(!event.team.length&&!prior.team.length)errors.push('Duplicate event row in this upload.')
      if(['endDate','endTime','eventKind','customCategory','subcategory','location','notes'].some(field=>prior[field]!==event[field]))errors.push('Conflicting event details in repeated rows.')
      if(event.team.some(member=>prior.team.some(existing=>existing.personId===member.personId)))errors.push('Duplicate member assignment in this upload.')
      if(!errors.length)prior.team.push(...event.team)
    }else events.set(key,event)
    rows.push({line,title,date,time,endTime,memberText,personId:person?.id||'',role:role?.name||roleText,errors})
  }
  if(events.size>52)rows.push({line:'—',errors:['Import no more than 52 events at a time.']})
  return {rows,events:[...events.values()],valid:rows.length>0&&rows.every(row=>!row.errors.length),assignments:[...events.values()].reduce((sum,event)=>sum+event.team.length,0)}
}
