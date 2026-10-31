import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarEntries, cairoToday, entryOnDay, eventKind, eventStage, normalizePlanningFields, planningOccurrences, publicationIssues, validatePlanningEvent } from '../src/lib/planningCalendar.js'
import { schedulePrintHtml } from '../src/lib/schedulePdf.js'
const base={eventKind:'general_meeting',title:'Planning',date:'2026-11-02',endDate:'2026-11-02',time:'18:00',endTime:'20:00',team:[],location:'Church hall',locationUrl:'https://example.org/map',practice:null}
test('all five event types persist through explicit snake_case boundaries',()=>{
  for(const eventKind of ['youth_meeting','service','general_meeting','prayer_shift','conference']){
    const rows=planningOccurrences({...base,eventKind})
    assert.equal(rows.length,1);assert.equal(rows[0].event_kind,eventKind)
    assert.ok(!Object.hasOwn(rows[0],'eventKind'))
    const reloaded=normalizePlanningFields(JSON.parse(JSON.stringify(rows[0])))
    assert.equal(reloaded.endTime,'20:00');assert.equal(reloaded.locationUrl,base.locationUrl)
    assert.equal(reloaded.timezone,'Africa/Cairo');assert.equal(reloaded.eventKind,eventKind)
    assert.equal(reloaded.publishedAt,null)
  }
})
test('overnight shifts and multi-day conferences retain their exact date range',()=>{
  for(const eventKind of ['prayer_shift','conference'])assert.equal(validatePlanningEvent({...base,eventKind,time:'23:00',endTime:'02:00',endDate:'2026-11-03'}),'')
  assert.match(validatePlanningEvent({...base,time:'23:00',endTime:'02:00'}),/End must/)
  assert.match(validatePlanningEvent({...base,endDate:'2026-11-03'}),/Only conferences/)
  assert.match(validatePlanningEvent({...base,date:'2026-02-30'}),/valid start/)
  assert.match(validatePlanningEvent({...base,locationUrl:'javascript:alert(1)'}),/HTTP/)
  assert.match(validatePlanningEvent({...base,locationUrl:'https://user:pass@example.org'}),/HTTP/)
})
test('explicit recurrence preserves multi-day duration and rehearsal offset across months',()=>{
  const rows=planningOccurrences({...base,eventKind:'conference',date:'2027-01-31',endDate:'2027-02-02',practice:{enabled:true,date:'2027-01-30',time:'17:00',attendance:{member:'present'}},recurrence:{enabled:true,frequency:'monthly',count:3}})
  assert.deepEqual(rows.map(row=>row.date),['2027-01-31','2027-02-28','2027-03-31'])
  assert.deepEqual(rows.map(row=>row.end_date),['2027-02-02','2027-03-02','2027-04-02'])
  assert.deepEqual(rows.map(row=>row.practice.date),['2027-01-30','2027-02-27','2027-03-30'])
  assert.equal(new Set(rows.map(row=>row.id)).size,3)
  assert.equal(new Set(rows.map(row=>row.recurrence_group_id)).size,1)
  assert.throws(()=>planningOccurrences({...base,recurrence:{enabled:true,count:53,frequency:'weekly'}}))
  assert.throws(()=>planningOccurrences({...base,recurrence:{enabled:true,count:3,frequency:'weekly',endDate:base.date}}))
})
test('member calendar hides drafts and archives, filters assignments, and derives rehearsal only once',()=>{
  const services=[{...base,id:'draft',status:'draft'},{...base,id:'public',publishedAt:'saved',team:[{personId:'me'}],practice:{enabled:true,date:'2026-11-01',time:'17:00'}},{...base,id:'cancelled',publishedAt:'saved',status:'cancelled'},{...base,id:'archive',publishedAt:'saved',archivedAt:'saved'}]
  const all=calendarEntries(services,'2026-10-01','2027-01-01')
  assert.deepEqual(all.map(row=>row.calendarId),['public:rehearsal','public','cancelled'])
  assert.equal(calendarEntries(services,'2026-10-01','2027-01-01',{mine:true,userId:'me'}).length,2)
  assert.equal(calendarEntries(services,'2026-10-01','2027-01-01',{manager:true,cancelled:false}).length,3)
  assert.equal(eventStage(services[0]),'draft');assert.equal(eventStage(services[1]),'published')
  const crossing=calendarEntries([{...base,id:'cross',eventKind:'conference',date:'2026-09-30',endDate:'2026-10-02',publishedAt:'saved'}],'2026-10-01','2027-01-01')
  assert.equal(crossing.length,1);assert.equal(entryOnDay(crossing[0],'2026-10-01'),true)
})
test('Cairo scheduling date does not use the browser timezone',()=>{
  assert.equal(cairoToday(new Date('2026-11-01T22:30:00Z')),'2026-11-02')
  assert.equal(eventKind({weeklyTemplateKey:'youth'}),'youth_meeting')
})
test('publication leader requirement applies only to worship workflows',()=>{
  const event={...base,endTime:'20:00'}
  assert.deepEqual(publicationIssues(event,[]),[])
  assert.equal(publicationIssues({...event,eventKind:'service'},[]).length,1)
  assert.deepEqual(publicationIssues({...event,eventKind:'service',team:[{roleId:'leader'}]},[{id:'leader',scheduleLeaderRole:true}]),[])
})
test('PDF covers all event types, date ranges, locations, and excludes private notes',()=>{
  const types=['youth_meeting','service','general_meeting','prayer_shift','conference']
  const html=schedulePrintHtml({services:types.map((eventKind,index)=>({...base,id:index,eventKind,publishedAt:'saved',endDate:eventKind==='conference'?'2026-11-04':base.endDate,notes:'PRIVATE REASON'})),slots:[],people:[],year:2026,quarter:4})
  for(const label of ['Youth Meeting','Service','General Meeting','House of Prayer Shift','Conference','Church hall','2026-11-04','8:00 PM'])assert.ok(html.includes(label),label)
  assert.ok(!html.includes('PRIVATE REASON'))
  assert.ok(!html.includes('Unresolved vacancy</td>'))
})
test('cleanup identifies non-Youth records while retaining linked data and intentional empty state',async()=>{
  const {cleanupDemoCalendar}=await import('../src/lib/planningCalendar.js')
  const linked={...base,id:'linked',weeklyTemplateKey:'prayer',status:'scheduled',team:[{personId:'p',status:'confirmed'}],setlist:[{songId:'song'}]}
  const youth={...base,id:'youth',weeklyTemplateKey:'youth',eventKind:'youth_meeting',status:'scheduled'}
  const cleanup=cleanupDemoCalendar([linked,youth],'2026-11-01','snapshot-time')
  assert.equal(cleanup.affected[0],linked)
  assert.equal(cleanup.services[0].status,'cancelled');assert.equal(cleanup.services[0].archivedAt,'snapshot-time')
  assert.deepEqual(cleanup.services[0].team,linked.team);assert.deepEqual(cleanup.services[0].setlist,linked.setlist)
  assert.equal(cleanup.services[1],youth)
  assert.deepEqual(cleanupDemoCalendar([]).services,[])
  assert.equal(cleanupDemoCalendar(cleanup.services,'2026-11-01').affected.length,0)
  const manual={...base,id:'manual',status:'scheduled'}
  assert.equal(cleanupDemoCalendar([manual],'2026-11-01').affected.length,0)
  assert.equal(cleanupDemoCalendar([manual],'2026-11-01','snapshot-time',['manual']).affected.length,1)
})
test('My assignments retains a recorded decline after the replacement slot is vacated',()=>{
  const event={...base,id:'declined',publishedAt:'saved',team:[],declinedPersonIds:['me']}
  const rows=calendarEntries([event],'2026-10-01','2027-01-01',{mine:true,userId:'me'})
  assert.equal(rows.length,1)
  assert.deepEqual(rows[0].declinedPersonIds,['me'])
})
test('planning validation messages have an Arabic presentation without changing validation rules',async()=>{
  const {planningMessage}=await import('../src/lib/planningCalendar.js')
  const error=validatePlanningEvent({...base,title:''})
  assert.equal(planningMessage(error,false),'Enter an event title.')
  assert.equal(planningMessage(error,true),'أدخل عنوان الفعالية.')
})
test('legacy demo events reuse canonical IDs and retain RSVP links without duplicate calendar rows',async()=>{
  const {importDemoEvents}=await import('../src/lib/planningCalendar.js')
  const events=[{id:'legacy',title:'Conference',date:base.date,time:base.time,type:'Conference',endDate:'2026-11-04',status:'upcoming'}]
  const first=importDemoEvents([],events)
  assert.equal(first.services.length,1)
  assert.equal(first.services[0].eventKind,'conference')
  assert.equal(first.events[0].calendarServiceId,first.services[0].id)
  assert.deepEqual(importDemoEvents(first.services,first.events),first)
  const existing={...base,id:'canonical',title:'Conference'}
  const matched=importDemoEvents([existing],events)
  assert.equal(matched.services.length,1)
  assert.equal(matched.events[0].calendarServiceId,'canonical')
})
