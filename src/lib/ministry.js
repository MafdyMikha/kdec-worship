import { normalizeMinistryRow } from './ministryData.js'
import { eventKind, cairoToday } from './planningCalendar.js'
import { normalizeArabicSearch } from './songImport.js'

export const MINISTRY_ROLES = {
  technical_admin: { en:'Technical Admin', ar:'مسؤول تقني', permissions:['users.view','ratings.view','ratings.musician','ratings.vocal','ratings.leader','ratings.configure','evaluations.manage','reports.view'] },
  musical_admin: { en:'Musical Admin', ar:'مسؤول موسيقي', permissions:['users.view','ratings.view','ratings.musician','ratings.vocal','ratings.leader'] },
  pastoral_admin: { en:'Pastoral Admin', ar:'مسؤول رعوي', permissions:['users.view','reports.view'] },
  worship_leader: { en:'Worship Leader', ar:'قائد تسبيح', permissions:['reports.own'] },
}
export const MEMBER_CATEGORIES = { member:{en:'Team member',ar:'عضو الفريق'}, newcomer:{en:'Audition / newcomer',ar:'اختبار / عضو جديد'}, outsider:{en:'Guest contributor',ar:'مشارك من خارج الفريق'} }
export const SERVING_STATUSES = { active:{en:'Active',ar:'نشط'}, inactive:{en:'Temporarily inactive',ar:'غير نشط مؤقتاً'}, leave:{en:'On leave',ar:'في إجازة'}, archived:{en:'Former member',ar:'عضو سابق'} }
export const RATING_AUDIENCES = { musician:{en:'Musicians',ar:'العازفون'}, vocal:{en:'Vocalists',ar:'المرنمون'}, leader:{en:'Worship leaders',ar:'قادة التسبيح'} }
export const ministryRoleNames = user => user?.ministryRoles || user?.ministry_roles || []
export const searchText = value => normalizeArabicSearch(value).toLocaleLowerCase('en').trim()
export function canEvaluate(user) {
  return Boolean(user && user.status==='active' && (user.accessLevel==='super_admin' || user.access_level==='super_admin' || ministryRoleNames(user).includes('technical_admin')))
}
export function ratingScore(scores=[], criteria=[]) {
  let sum=0, weight=0
  for(const criterion of criteria){
    const value=scores.find(score=>(score.criterionId??score.criterion_id)===criterion.id)?.value
    if(value==null || value==='')continue
    const min=Number(criterion.minimum),max=Number(criterion.maximum),w=Number(criterion.weight)
    if(!Number.isFinite(Number(value)) || max<=min || !Number.isFinite(w) || w<=0 || Number(value)<min || Number(value)>max)continue
    sum+=(Number(value)-min)/(max-min)*100*w;weight+=w
  }
  return weight ? Math.round(sum/weight*10)/10 : null
}
export function validateCriterion(value) {
  if(!String(value.name||'').trim())return 'A criterion name is required.'
  if(!RATING_AUDIENCES[value.audience])return 'Choose an audience.'
  if(![value.minimum,value.maximum,value.weight,value.displayOrder??value.display_order].every(number=>number!==''&&Number.isFinite(Number(number))))return 'Scale, weight and order must be numbers.'
  if(!Number.isInteger(Number(value.minimum))||!Number.isInteger(Number(value.maximum))||Number(value.maximum)<=Number(value.minimum)||Number(value.maximum)-Number(value.minimum)>20)return 'Use a whole-number scale with 1–20 intervals.'
  if(!Number.isInteger(Number(value.displayOrder??value.display_order)))return 'Display order must be a whole number.'
  if(Number(value.weight)<=0||Number(value.weight)>1000)return 'Weight must be greater than zero and at most 1,000.'
  return null
}
export function validateScores(scores,criteria) {
  if(new Set(scores.map(score=>(score.criterionId??score.criterion_id))).size!==scores.length)return 'Duplicate rating criteria.'
  for(const score of scores){
    const criterion=criteria.find(item=>item.id===(score.criterionId??score.criterion_id))
    if(!criterion || !Number.isInteger(Number(score.value)) || Number(score.value)<criterion.minimum || Number(score.value)>criterion.maximum)return 'Choose a valid rating for every selected criterion.'
  }
  return null
}
export const percentage = (part,total) => total ? Math.round(part/total*1000)/10 : null
export const average = values => values.length ? Math.round(values.reduce((sum,value)=>sum+value,0)/values.length*10)/10 : null
export function responseMinutes(sent,responded) {
  if(!sent||!responded)return null
  const duration=(Date.parse(responded)-Date.parse(sent))/60000
  return Number.isFinite(duration)&&duration>=0?duration:null
}
export function quarterDates(year,quarter) {
  if(!Number.isInteger(+year)||+year<2000||+year>2200||![1,2,3,4].includes(+quarter))return null
  const month=(+quarter-1)*3+1
  return {from:`${year}-${String(month).padStart(2,'0')}-01`,to:new Date(Date.UTC(+year,month+2,0)).toISOString().slice(0,10)}
}
export const inRange = (date,filters={}) => Boolean(date && (!filters.from||date>=filters.from) && (!filters.to||date<=filters.to))
export const serviceCategory = service => service.subcategory||service.customCategory||service.custom_category||service.type||eventKind(service)
export function primaryLeader(service,roles=[]) {
  return (service.team||[]).filter(member=>member.status!=='declined').find(member=>member.roleDefinition?.scheduleLeaderRole||roles.some(role=>role.id===member.roleId&&role.scheduleLeaderRole)||member.role==='Worship Leader')?.personId || null
}

export function reportDay(value, timezone='Africa/Cairo') {
  if(!value)return ''
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value
  const date=new Date(value)
  return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
}
export function periodEligibility(person,history=[],filters={}) {
  if(filters.to&&person.joinDate&&person.joinDate>filters.to)return false
  if(!filters.from||!filters.to)return true
  const changes=history.map(normalizeMinistryRow).filter(row=>row.personId===person.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))
  const before=changes.filter(row=>reportDay(row.createdAt)<=filters.from).at(-1)
  if(!before)return true // Unknown historical leave is disclosed, never guessed.
  return before.snapshot.servingStatus==='active'||changes.some(row=>inRange(reportDay(row.createdAt),filters)&&row.snapshot.servingStatus==='active')
}

// Every count uses recorded evidence. Confirmation never implies attendance.
export function buildMinistryReport({services=[],songs=[],people=[],sessions=[],records={},responses=[],appearances=[],roles=[],filters={},allServices=services,memberHistory=[],includeStandalone=true,timezone='Africa/Cairo',now=new Date()}) {
  responses=responses.map(normalizeMinistryRow)
  appearances=appearances.map(normalizeMinistryRow)
  const q=searchText(filters.search||''),searchScope=filters.searchScope||'all'
  const matchesPerson=person=>(!filters.member||person.id===filters.member)&&(!filters.role||(person.roles||[person.role]).includes(filters.role))&&(!filters.category||(person.category||'member')===filters.category)&&(!filters.status||(person.servingStatus||person.status)===filters.status)&&(!q||!['people','all'].includes(searchScope)||searchText([person.name,person.email,...(person.roles||[])].join(' ')).includes(q))
  const selectedPeople=people.filter(matchesPerson),personIds=new Set(selectedPeople.map(person=>person.id))
  const peopleMap=new Map(people.map(person=>[person.id,person])),songMap=new Map(songs.map(song=>[song.id,song]))
  const personFacet=Boolean(filters.member||filters.role||filters.category||filters.status||(q&&searchScope==='people'))
  const eventMatches=service=>service.status!=='cancelled'&&!service.archivedAt&&!service.archived_at&&(!filters.kind||eventKind(service)===filters.kind)&&(!filters.subcategory||serviceCategory(service)===filters.subcategory)&&(!filters.leader||primaryLeader(service,roles)===filters.leader)&&(!personFacet||(service.team||[]).some(member=>personIds.has(member.personId))||(service.participantIds||[]).some(id=>personIds.has(id))||responses.some(row=>row.serviceId===service.id&&personIds.has(row.personId)))&&(!q||searchScope!=='events'||searchText([service.title,serviceCategory(service),...(service.team||[]).map(member=>peopleMap.get(member.personId)?.name),...(service.setlist||[]).map(item=>songMap.get(item.songId)?.title)].join(' ')).includes(q))
  const candidateServices=services.filter(eventMatches)
  const filteredServices=candidateServices.filter(service=>inRange(service.date,filters)),serviceIds=new Set(filteredServices.map(service=>service.id))
  const today=cairoToday(now)
  const candidates=new Map(candidateServices.map(service=>[service.id,service]))
  const filteredSessions=sessions.filter(session=>{
    const sid=session.serviceId||session.service_id
    if(sid&&!candidates.has(sid))return false
    if(!sid&&(!includeStandalone||filters.kind||filters.subcategory||filters.leader))return false
    return inRange(session.sessionDate||session.session_date||session.service?.date,filters)||(records[session.id]||[]).some(row=>inRange(row.occurrence_date||reportDay(row.check_in_at,timezone),filters))
  })
  const sessionMap=new Map(filteredSessions.map(session=>[String(session.id),session]))
  const attendance=Object.entries(records).flatMap(([id,rows])=>{
    const session=sessionMap.get(String(id));if(!session)return []
    return rows.filter(row=>personIds.has(row.person_id)&&inRange(row.occurrence_date||reportDay(row.check_in_at,timezone)||session.sessionDate||session.session_date||session.service?.date,filters)).map(row=>({...row,session_id:id}))
  })
  const byPerson=selectedPeople.map(person=>{
    const assignments=filteredServices.flatMap(service=>(service.team||[]).filter(member=>member.personId===person.id).map(member=>({...member,serviceId:service.id})))
    const history=responses.filter(row=>row.personId===person.id&&serviceIds.has(row.serviceId)&&(!row.actor||row.actor===person.id))
    const requests=new Map(),first=new Map(),firstAccept=new Map(),firstReject=new Map()
    for(const row of history){
      const key=row.requestKey||`${row.serviceId}:${row.personId}`
      if(!requests.has(key)||Date.parse(row.respondedAt)>Date.parse(requests.get(key).respondedAt))requests.set(key,row)
      if(!first.has(key)||Date.parse(row.respondedAt)<Date.parse(first.get(key).respondedAt))first.set(key,row)
      const outcomes=row.response==='confirmed'?firstAccept:firstReject
      if(!outcomes.has(key)||Date.parse(row.respondedAt)<Date.parse(outcomes.get(key).respondedAt))outcomes.set(key,row)
    }
    const accepted=[...requests.values()].filter(row=>row.response==='confirmed').length,rejected=[...requests.values()].filter(row=>row.response==='declined').length
    const attendanceRows=attendance.filter(row=>row.person_id===person.id&&row.check_in_at)
    const attended=new Set(attendanceRows.map(row=>`${row.session_id}:${row.occurrence_date||reportDay(row.check_in_at,timezone)}`)).size
    const played=appearances.filter(row=>row.personId===person.id&&serviceIds.has(row.serviceId)&&row.played)
    const stage=new Set(played.map(row=>row.serviceId)).size
    const activityKeys=new Set(played.map(row=>`event:${row.serviceId}`))
    attendanceRows.forEach(row=>{const session=sessionMap.get(row.session_id);const sid=session.serviceId||session.service_id;const day=row.occurrence_date||reportDay(row.check_in_at,timezone),parent=candidates.get(sid);const serviceSession=parent&&day===parent.date&&String(session.sessionTime||session.session_time).slice(0,5)===String(parent.time).slice(0,5);activityKeys.add(serviceSession?`event:${sid}:${day}`:`session:${row.session_id}:${day}`)})
    // Use service date for both evidence types so QR attendance + playing at the
    // same occurrence is counted once, while recurrent attendance stays distinct.
    played.forEach(row=>{activityKeys.delete(`event:${row.serviceId}`);activityKeys.add(`event:${row.serviceId}:${candidates.get(row.serviceId)?.date}`)})
    const participantEvents=filteredServices.filter(service=>(service.participantIds||[]).includes(person.id)).length
    const pendingAssignments=assignments.filter(row=>row.status==='pending'&&(candidates.get(row.serviceId)?.publishedAt||candidates.get(row.serviceId)?.published_at))
    const closedAssignment=row=>candidates.get(row.serviceId)?.status==='completed'||candidates.get(row.serviceId)?.date<today
    const scheduled=new Set([...assignments.map(row=>row.serviceId),...history.map(row=>row.serviceId)]).size
    const rehearsals=candidateServices.filter(service=>service.practice?.enabled&&inRange(service.practice.date,filters)&&(service.team||[]).some(member=>member.personId===person.id)).length
    return {person,scheduled,participantEvents,rehearsals,confirmed:assignments.filter(row=>row.status==='confirmed').length,declined:assignments.filter(row=>row.status==='declined').length,pending:pendingAssignments.filter(row=>!closedAssignment(row)).length,expired:pendingAssignments.filter(closedAssignment).length,attended,stage,activity:activityKeys.size,accepted,rejected,acceptedActions:history.filter(row=>row.response==='confirmed').length,rejectedActions:history.filter(row=>row.response==='declined').length,responseChanges:history.length,acceptanceRate:percentage(accepted,accepted+rejected),responseMinutes:average([...first.values()].map(row=>responseMinutes(row.sentAt,row.respondedAt)).filter(value=>value!==null)),acceptanceMinutes:average([...firstAccept.values()].map(row=>responseMinutes(row.sentAt,row.respondedAt)).filter(value=>value!==null)),rejectionMinutes:average([...firstReject.values()].map(row=>responseMinutes(row.sentAt,row.respondedAt)).filter(value=>value!==null)),eligible:periodEligibility(person,memberHistory,filters)}
  }).filter(row=>(filters.minStage==null||filters.minStage===''||row.stage>=Number(filters.minStage))&&(filters.maxStage==null||filters.maxStage===''||row.stage<=Number(filters.maxStage))).sort((a,b)=>b.activity-a.activity||b.scheduled-a.scheduled||a.person.name.localeCompare(b.person.name))
  const matchesSong=song=>(!filters.song||song.id===filters.song)&&(!filters.tag||(song.themes||song.tags||[]).includes(filters.tag))&&(!filters.key||song.key===filters.key)&&(!filters.originYear||String(song.originYear||'unknown')===filters.originYear)&&(!q||!['songs','all'].includes(searchScope)||searchText([song.title,song.titleEn,song.author,...(song.themes||song.tags||[])].join(' ')).includes(q))
  const selectedSongs=songs.filter(matchesSong),songIds=new Set(selectedSongs.map(song=>song.id))
  const completed=filteredServices.filter(service=>service.status==='completed'&&(service.setlistFinalized||service.setlist_finalized))
  const sets=completed.map(service=>({service,items:(service.setlist||[]).filter(item=>songIds.has(item.songId))}))
  const allCompleted=allServices.filter(service=>service.status==='completed'&&(service.setlistFinalized||service.setlist_finalized)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
  const firstUses=new Map()
  allCompleted.forEach(service=>(service.setlist||[]).forEach(item=>{if(!firstUses.has(item.songId))firstUses.set(item.songId,service)}))
  const songRows=selectedSongs.map(song=>({song,occurrences:sets.reduce((sum,set)=>sum+set.items.filter(item=>item.songId===song.id).length,0),added:inRange(reportDay(song.createdAt||song.created_at,timezone),filters),introduced:Boolean(firstUses.has(song.id)&&serviceIds.has(firstUses.get(song.id).id)&&inRange(firstUses.get(song.id).date,filters))})).sort((a,b)=>b.occurrences-a.occurrences||a.song.title.localeCompare(b.song.title))
  const leaderIds=new Set(filteredServices.map(service=>primaryLeader(service,roles)).filter(Boolean))
  const leaders=[...leaderIds].map(id=>{
    const led=filteredServices.filter(service=>primaryLeader(service,roles)===id),leaderSets=sets.filter(set=>primaryLeader(set.service,roles)===id),items=leaderSets.flatMap(set=>set.items)
    return {id,name:peopleMap.get(id)?.name||id,services:led.length,sets:leaderSets.length,songs:items.length,unique:new Set(items.map(item=>item.songId)).size,average:average(leaderSets.map(set=>set.items.length)),categories:Object.entries(led.reduce((all,event)=>{const category=serviceCategory(event);all[category]=(all[category]||0)+1;return all},{})),months:Object.entries(led.reduce((all,event)=>{const month=event.date.slice(0,7);all[month]=(all[month]||0)+1;return all},{})).sort(([a],[b])=>a.localeCompare(b)),introduced:songRows.filter(row=>row.introduced&&primaryLeader(firstUses.get(row.song.id),roles)===id).length}
  })
  const group=key=>Object.entries(selectedSongs.reduce((all,song)=>{const keys=key==='tags'?(song.themes||song.tags||[]):[song[key]||'unknown'];for(const value of new Set(keys))all[value]=(all[value]||0)+1;return all},{})).sort((a,b)=>b[1]-a[1])
  const includedPeople=new Set(byPerson.map(row=>row.person.id))
  return {services:filteredServices,sessions:filteredSessions,attendance:attendance.filter(row=>includedPeople.has(row.person_id)),people:byPerson,songs:songRows,leaders,sets:sets.length,averageSongs:average(sets.map(set=>set.items.length)),songOccurrences:sets.reduce((sum,set)=>sum+set.items.length,0),uniqueSongs:new Set(sets.flatMap(set=>set.items.map(item=>item.songId))).size,byKey:group('key'),byYear:group('originYear'),byTag:group('tags')}
}
