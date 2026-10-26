import test from 'node:test'
import assert from 'node:assert/strict'
import { quarterBounds, quarterServices, weightedCandidate, normalizeQuarterly, loadScheduleRows } from '../src/lib/quarterlySchedule.js'
import { schedulePrintHtml } from '../src/lib/schedulePdf.js'

test('quarters include boundaries and sort chronologically',()=>{
  assert.deepEqual(quarterBounds(2026,4),{start:'2026-10-01',end:'2027-01-01'})
  assert.throws(()=>quarterBounds(2026,0))
  assert.deepEqual(quarterServices([{date:'2027-01-01'},{date:'2026-10-01',time:'18:00'},{date:'2026-10-01',time:'09:00'}],2026,4).map(s=>s.time),['09:00','18:00'])
})
test('persisted schedule rows normalize across reload without losing version or notification state',()=>{
  const row={id:'slot',service_id:'service',person_id:'person',role_id:'role',version:3,state:'confirmed',leader:true}
  const state=normalizeQuarterly({slots:[row],inbox:[{id:'notice',service_id:'service',read_at:'2026-10-26T10:00:00Z'}],ready:true})
  assert.equal(state.slots[0].personId,'person')
  assert.equal(state.slots[0].serviceId,'service')
  assert.equal(state.slots[0].version,3)
  assert.equal(state.inbox[0].readAt,'2026-10-26T10:00:00Z')
  assert.equal(state.ready,true)
  assert.ok(!Object.hasOwn(state.slots[0],'person_id'))
})
test('schedule loading crosses the default API row limit and rejects partial data on error',async()=>{
  const rows=Array.from({length:1250},(_,id)=>({id}))
  const client={from:()=>({select:()=>({order:()=>({range:async(first,last)=>({data:rows.slice(first,last+1),error:null})})})})}
  assert.equal((await loadScheduleRows(client,'schedule_slots')).data.length,1250)
  const errorClient={from:()=>({select:()=>({order:()=>({range:async(first)=>first?{data:null,error:{message:'Offline'}}:{data:rows.slice(0,500),error:null}})})})}
  assert.deepEqual(await loadScheduleRows(errorClient,'schedule_slots'),{data:null,error:{message:'Offline'}})
})
test('weighted selection favors lower workload without starving heavier members',()=>{
  let seed=92
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
  const candidates=[{id:'light',assignments:0,replacements:0},{id:'heavy',assignments:8,replacements:3}]
  const counts={light:0,heavy:0}
  for(let i=0;i<10000;i++)counts[weightedCandidate(candidates,random).id]++
  assert.ok(counts.light>counts.heavy*8)
  assert.ok(counts.heavy>0)
  assert.equal(weightedCandidate([],random),null)
})
test('PDF layout escapes names and excludes private information and proposals',()=>{
  for(const isAr of [false,true]){
    const html=schedulePrintHtml({services:[{id:'s',title:'<script>alert(1)</script>',date:'2026-10-26',time:'18:00',status:'scheduled',team:[],notes:'PRIVATE NOTES'}],slots:[{serviceId:'s',role:'Guitar',personId:'p',state:'pending'}],people:[{id:'p',name:'اسم طويل & Name',email:'PRIVATE_EMAIL',phone:'PRIVATE_PHONE'}],year:2026,quarter:4,isAr})
    assert.ok(html.includes('6:00 PM'))
    assert.ok(html.includes(isAr?'dir="rtl"':'dir="ltr"'))
    assert.ok(html.includes('&lt;script&gt;'))
    assert.ok(!html.includes('PRIVATE_'))
    assert.ok(html.includes('table-header-group'))
    assert.ok(html.includes('counter(page)'))
  }
})
