import test from 'node:test'
import assert from 'node:assert/strict'
import { canEvaluate, ratingScore, validateCriterion, validateScores, responseMinutes, quarterDates, buildMinistryReport } from '../src/lib/ministry.js'
import { hasPermission } from '../src/lib/permissions.js'
import { earlyCheckoutRate } from '../src/lib/attendanceReport.js'
import { previewSchedule, suggestScheduleMapping, importTime } from '../src/lib/scheduleImport.js'
import { prepareSongForm } from '../src/lib/songLibrary.js'

const member={id:'p',name:'Mikha',status:'active',joinDate:'2026-02-01',roles:['Keys'],roleIds:['keys']}
const leader={id:'l',name:'Leader',status:'active',roles:['Worship Leader']}
const service={id:'e',title:'Youth',date:'2026-04-10',status:'completed',eventKind:'youth_meeting',setlistFinalized:true,team:[{personId:'p',role:'Keys',status:'confirmed'},{personId:'l',role:'Worship Leader',status:'confirmed'}],setlist:[{songId:'s'},{songId:'s'}]}
const song={id:'s',title:'Song',originYear:2020,key:'C',themes:['Praise'],createdAt:'2026-04-02T10:00:00Z'}
test('evaluation access is exact, active and independent from general admin permissions',()=>{
 for(const accessLevel of ['admin','leader','member'])assert.equal(canEvaluate({accessLevel,status:'active',permissions:['*']}),false)
 assert.equal(canEvaluate({accessLevel:'member',status:'active',ministryRoles:['technical_admin']}),true)
 assert.equal(hasPermission({accessLevel:'admin',status:'active',permissions:['*']},'evaluations.manage'),false)
 assert.equal(canEvaluate({accessLevel:'super_admin',status:'inactive'}),false)
 assert.equal(hasPermission({accessLevel:'member',status:'on-leave',ministryRoles:['technical_admin']},'reports.view'),false)
 assert.equal(hasPermission({accessLevel:'member',status:'active',ministryRoles:['pastoral_admin']},'reports.view'),true)
 assert.equal(hasPermission({accessLevel:'member',status:'active',ministryRoles:['musical_admin']},'ratings.musician'),true)
 assert.equal(hasPermission({accessLevel:'member',status:'active',ministryRoles:['worship_leader']},'reports.own'),true)
 assert.equal(hasPermission({accessLevel:'member',status:'active',ministryRoles:['worship_leader']},'reports.view'),false)
})
test('ratings normalize weighted scales and exclude unrated criteria',()=>{
 const criteria=[{id:'a',minimum:1,maximum:5,weight:2},{id:'b',minimum:0,maximum:10,weight:1}]
 assert.equal(ratingScore([{criterion_id:'a',value:5},{criterion_id:'b',value:0}],criteria),66.7)
 assert.equal(ratingScore([{criterion_id:'a',value:1}],criteria),0)
 assert.equal(ratingScore([],criteria),null)
 assert.equal(ratingScore([{criterion_id:'a',value:99}],criteria),null)
 assert.ok(validateScores([{criterion_id:'a',value:2},{criterion_id:'a',value:3}],criteria))
 assert.ok(validateCriterion({name:'Timing',audience:'musician',minimum:1,maximum:99,weight:1,display_order:1}))
})
test('quarters, response durations and early checkout percentage avoid fabricated zeros',()=>{
 assert.deepEqual(quarterDates(2026,4),{from:'2026-10-01',to:'2026-12-31'})
 assert.equal(quarterDates(2026,5),null)
 assert.equal(responseMinutes(null,'2026-01-01'),null)
 assert.equal(responseMinutes('2026-01-01T00:00Z','2026-01-01T00:15Z'),15)
 assert.equal(responseMinutes('2026-01-01T00:15Z','2026-01-01T00:00Z'),null)
 assert.deepEqual(earlyCheckoutRate([{checkInAt:'x',checkOutAt:'x',departure:'early'},{checkInAt:'x',checkOutAt:'x',departure:'normal'},{checkInAt:'x',departure:'unknown'}]),{early:1,eligible:2,rate:50})
 assert.equal(earlyCheckoutRate([]).rate,null)
})
test('reports separate scheduled, confirmed, attended and recorded stage participation',()=>{
 const report=buildMinistryReport({services:[service,{...service,id:'cancelled',status:'cancelled'}],songs:[song],people:[member,leader],sessions:[{id:'session',serviceId:'e',sessionDate:'2026-04-10'}],records:{session:[{person_id:'p',check_in_at:'2026-04-10T10:00Z',occurrence_date:'2026-04-10'}]},appearances:[{person_id:'l',service_id:'e',played:true}],filters:{from:'2026-04-01',to:'2026-06-30'}})
 const person=report.people.find(row=>row.person.id==='p')
 assert.equal(person.scheduled,1);assert.equal(person.attended,1);assert.equal(person.stage,0)
 assert.equal(report.averageSongs,2);assert.equal(report.uniqueSongs,1);assert.equal(report.songOccurrences,2)
 assert.equal(report.leaders[0].average,2);assert.equal(report.songs[0].introduced,true)
 assert.deepEqual(report.byTag,[['Praise',1]])
})
test('unfinalized sets are excluded, finalized empty sets count as zero and leader attribution is singular',()=>{
 const report=buildMinistryReport({services:[service,{...service,id:'empty',setlist:[]},{...service,id:'unfinished',setlistFinalized:false,setlist:[{songId:'s'}]}],songs:[song],people:[member,leader]})
 assert.equal(report.sets,2);assert.equal(report.averageSongs,1);assert.equal(report.leaders.length,1);assert.equal(report.leaders[0].sets,2)
})
test('response history counts unique final outcomes, preserves changes and uses first response speed',()=>{
 const responses=[{service_id:'e',person_id:'p',request_key:'request',sent_at:'2026-04-10T10:00Z',responded_at:'2026-04-10T10:20Z',response:'confirmed'},{service_id:'e',person_id:'p',request_key:'request',sent_at:'2026-04-10T10:00Z',responded_at:'2026-04-10T10:30Z',response:'declined'}]
 const row=buildMinistryReport({services:[service],people:[member],responses}).people[0]
 assert.equal(row.accepted,0);assert.equal(row.rejected,1);assert.equal(row.responseChanges,2);assert.equal(row.responseMinutes,20)
})
test('historical first song introduction does not become new again under date filters',()=>{
 const earlier={...service,id:'earlier',date:'2026-01-01'}
 const report=buildMinistryReport({services:[earlier,service],songs:[song],people:[member],filters:{from:'2026-04-01',to:'2026-06-30'}})
 assert.equal(report.songs[0].introduced,false)
 assert.equal(report.songs[0].added,true)
})
test('schedule upload validates mapping, grouping, ambiguous names and duplicates',()=>{
 const table=[['title','date','start_time','end_time','event_kind','member','role'],['Youth','2026-11-06','6:00 PM','8:00 PM','youth_meeting','Mikha','Keys']]
 const mapping=suggestScheduleMapping(table[0]),options={people:[member],roles:[{id:'keys',name:'Keys',active:true}]}
 assert.equal(previewSchedule(table,mapping,options).valid,true)
 assert.equal(previewSchedule([...table,table[1]],mapping,options).valid,false)
 assert.equal(previewSchedule(table,mapping,{...options,people:[member,{...member,id:'other'}]}).valid,false)
 assert.equal(previewSchedule(table,mapping,{...options,people:[member,{...member,id:'other'}],resolutions:{2:'p'}}).valid,true)
 assert.equal(importTime('12:00 AM'),'00:00');assert.equal(importTime('12:00 PM'),'12:00');assert.equal(importTime('13:00 PM'),'')
})
test('song origin year is separate from creation date and validates unknown values',()=>{
 assert.equal(prepareSongForm({title:'Song',originYear:''}).value.originYear,null)
 assert.equal(prepareSongForm({title:'Song',originYear:2020}).value.originYear,2020)
 assert.ok(prepareSongForm({title:'Song',originYear:999}).errors.length)
})

test('database normalization and write boundaries preserve versioned scores without leaking extra properties',async()=>{
 const {normalizeMinistryRow,ministryPayload}=await import('../src/lib/ministryData.js')
 const row=normalizeMinistryRow({person_id:'p',scores:[{criterion_id:'c',name_ar:'معيار',display_order:0}],created_at:'2026-01-01'})
 assert.equal(row.personId,'p');assert.equal(row.scores[0].criterionId,'c');assert.equal(row.scores[0].displayOrder,0)
 assert.deepEqual(ministryPayload('ministry_save_member',{personId:'p',category:'newcomer',servingStatus:'active',leaderQuote:'Quote',accessLevel:'super_admin'}),{person_id:'p',category:'newcomer',serving_status:'active',leader_quote:'Quote'})
})
test('recurring attendance filters by occurrence date and does not invent attendance for participants',()=>{
 const parent={...service,date:'2026-01-01',participantIds:['p'],team:[]}
 const report=buildMinistryReport({services:[parent],people:[member],sessions:[{id:'repeat',serviceId:'e',sessionDate:'2026-01-01'}],records:{repeat:[{id:'r',person_id:'p',occurrence_date:'2026-04-10',check_in_at:'2026-04-10T10:00Z'}]},filters:{from:'2026-04-01',to:'2026-06-30'}})
 assert.equal(report.services.length,0);assert.equal(report.people[0].attended,1)
 const noAttendance=buildMinistryReport({services:[{...parent,date:'2026-04-10'}],people:[member],filters:{from:'2026-04-01',to:'2026-06-30'}})
 assert.equal(noAttendance.people[0].participantEvents,1);assert.equal(noAttendance.people[0].attended,0)
})
test('Cairo date boundaries and historical leave determine quarterly eligibility',async()=>{
 const {reportDay,periodEligibility}=await import('../src/lib/ministry.js')
 assert.equal(reportDay('2026-04-01T22:30:00Z'),'2026-04-02')
 assert.equal(periodEligibility({...member,joinDate:'2026-07-01'},[],{from:'2026-04-01',to:'2026-06-30'}),false)
 assert.equal(periodEligibility(member,[{personId:'p',createdAt:'2026-03-01T10:00Z',snapshot:{servingStatus:'leave'}}],{from:'2026-04-01',to:'2026-06-30'}),false)
})
test('attendance quick filters recalculate the same summary used by exports',async()=>{
 const {filterAttendanceReport}=await import('../src/lib/attendanceReport.js')
 const result=filterAttendanceReport({rows:[{personId:'p',arrival:'late'},{personId:'p',arrival:'on_time'}],summaries:[{person:member}]},'late')
 assert.equal(result.rows.length,1);assert.equal(result.summaries[0].records,1);assert.equal(result.summaries[0].late,1)
})

test('unanswered published assignments distinguish open requests from expired response windows',()=>{
 const pending={...service,status:'scheduled',publishedAt:'2026-04-01T10:00Z',team:[{personId:'p',status:'pending'}]}
 const report=buildMinistryReport({services:[pending,{...pending,id:'past',date:'2026-04-01'},{...pending,id:'draft',status:'draft',publishedAt:null}],people:[member],now:new Date('2026-04-05T10:00Z')})
 assert.equal(report.people[0].pending,1);assert.equal(report.people[0].expired,1)
})
test('archiving an older completed service does not fabricate a new song introduction',()=>{
 const earlier={...service,id:'earlier',date:'2026-01-01',archivedAt:'2026-02-01T10:00Z'}
 const report=buildMinistryReport({services:[earlier,service],songs:[song],people:[member],filters:{from:'2026-04-01',to:'2026-06-30'}})
 assert.equal(report.songs[0].introduced,false)
})
