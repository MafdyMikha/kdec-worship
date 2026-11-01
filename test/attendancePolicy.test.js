import test from 'node:test'
import assert from 'node:assert/strict'
import { validTolerance,effectiveTolerance,attendanceSnapshot,attendanceSchedule,validOccurrence,nextAttendanceOccurrence,attendanceCodeError } from '../src/lib/attendancePolicy.js'
import { attendanceTiming } from '../src/lib/attendance.js'
import { planningOccurrences,normalizePlanningFields,calendarEntries,publicationIssues,eventType } from '../src/lib/planningCalendar.js'
import { attendanceQrCard } from '../src/lib/attendanceQr.js'
const session={session_date:'2026-11-02',session_time:'19:00',end_time:'20:00',effective_late_minutes:3,active:true,expires_at:'2026-11-03T00:00:00Z'}
test('tolerance accepts zero and integers; rejects invalid input without coercion',()=>{
 for(const value of [0,1,300,'0','3',2147483647])assert.equal(validTolerance(value),true,String(value))
 for(const value of ['',null,undefined,true,' ', -1,1.5,'1.5',Infinity,2147483648])assert.equal(validTolerance(value),false,String(value))
 assert.equal(effectiveTolerance({}, {attendanceLateMinutes:3}),3)
 assert.equal(effectiveTolerance({}, {attendanceLateMinutes:3,attendanceLateEnabled:false}),0)
 assert.equal(effectiveTolerance({lateToleranceMode:'none'},{attendanceLateMinutes:3}),0)
 assert.equal(effectiveTolerance({lateToleranceMode:'custom',lateToleranceMinutes:0},{attendanceLateMinutes:3}),0)
})
test('strict Cairo boundary and frozen records survive default or session edits',()=>{
 const record={occurrence_date:session.session_date,check_in_at:'2026-11-02T17:03:00.000Z'}
 const ontime=attendanceSnapshot(record,session)
 assert.equal(ontime.status,'present');assert.equal(ontime.arrival_status,'on_time')
 const late=attendanceSnapshot({...record,check_in_at:'2026-11-02T17:03:00.001Z'},session)
 assert.equal(late.status,'late');assert.equal(late.late_by_minutes,4)
 assert.equal(attendanceTiming(late,{...session,effective_late_minutes:100},'Africa/Cairo',100).arrival,'late')
 assert.equal(attendanceTiming(ontime,{...session,effective_late_minutes:0},'Africa/Cairo',0).arrival,'on_time')
 const zero={...session,effective_late_minutes:0}
 assert.equal(attendanceSnapshot({...record,check_in_at:'2026-11-02T17:00:00Z'},zero).status,'present')
 assert.equal(attendanceSnapshot({...record,check_in_at:'2026-11-02T17:00:00.001Z'},zero).status,'late')
})
test('explicit multi-day attendance end remains frozen and uses Cairo timezone',()=>{
 const range={...session,session_end_date:'2026-11-04',end_time:'02:00'}
 assert.equal(attendanceSchedule(range).end.toISOString(),'2026-11-04T00:00:00.000Z')
 assert.equal(attendanceSchedule(range,'2026-12-02').end.toISOString(),'2026-12-04T00:00:00.000Z')
})
test('occurrences clamp monthly dates and reject wrong days or expired/revoked codes',()=>{
 const repeat={...session,session_date:'2027-01-31',repeatable:true,repeat_freq:'monthly'}
 assert.equal(validOccurrence(repeat,'2027-02-28'),true)
 assert.equal(validOccurrence(repeat,'2027-02-27'),false)
 assert.equal(validOccurrence(repeat,'2026-12-31'),false)
 assert.equal(nextAttendanceOccurrence(repeat,new Date('2027-02-01T12:00:00Z')),'2027-02-28')
 assert.equal(attendanceCodeError(session,{},session.session_date,new Date('2026-11-02T18:00:00Z')),'')
 assert.match(attendanceCodeError(session,{revoked:true},session.session_date),/revoked/)
 assert.match(attendanceCodeError({...session,active:false},{},session.session_date),/closed/)
 assert.match(attendanceCodeError(session,{},'2026-11-03'),/occurrence/)
 assert.match(attendanceCodeError(session,{},session.session_date,new Date('2026-11-01T12:00:00Z')),/not active yet/)
 assert.match(attendanceCodeError(session,{},session.session_date,new Date('2026-11-03T01:00:00Z')),/expired/)
})
test('custom recurrence, attendance policy and participants survive save/reload boundaries',()=>{
 const form={eventKind:'custom',customCategory:'Workshop',participantIds:['participant'],attendanceEnabled:true,lateToleranceMode:'none',lateToleranceMinutes:0,title:'Custom gathering',date:'2026-11-02',endDate:'2026-11-03',time:'19:00',endTime:'20:00',team:[],recurrence:{enabled:true,frequency:'weekly',count:2}}
 const rows=planningOccurrences(form)
 assert.equal(rows.length,2)
 for(const row of rows){const reloaded={...row,...normalizePlanningFields(JSON.parse(JSON.stringify(row)))}
 assert.equal(reloaded.customCategory,'Workshop');assert.deepEqual(reloaded.participantIds,['participant'])
 assert.equal(reloaded.lateToleranceMode,'none');assert.equal(reloaded.attendanceEnabled,true)
 assert.equal(eventType(reloaded).en,'Workshop');assert.deepEqual(publicationIssues(reloaded,[]),[])
 assert.equal(calendarEntries([{...reloaded,publishedAt:'saved'}],'2026-11-01','2027-01-01',{mine:true,userId:'participant'}).length,1)}
 assert.throws(()=>planningOccurrences({...form,customCategory:''}),/category/)
 assert.throws(()=>planningOccurrences({...form,lateToleranceMode:'custom',lateToleranceMinutes:-1}),/whole number/)
})
test('downloaded QR card escapes user content and leaves rendered QR untouched',()=>{
 const svg=attendanceQrCard({qrSvg:'<svg data-test="qr"/>',logoSvg:'<svg viewBox="0 0 320 384"></svg>',title:'<script>alert("x")</script>',label:'A&B',date:'2026-11-02',time:'19:00'})
 assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'))
 assert.ok(svg.includes('A&amp;B'));assert.ok(svg.includes('<svg data-test="qr"/>'))
 assert.ok(svg.includes('Scanning alone does not prove physical presence'))
})
