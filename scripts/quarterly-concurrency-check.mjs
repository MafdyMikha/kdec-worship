// Optional integration check. Creates and drops ONLY the dedicated LOCAL test DB.
import { readFileSync } from 'node:fs'
import { execFileSync,execFile } from 'node:child_process'
import { dirname,join } from 'node:path'
import assert from 'node:assert/strict'
const psql=process.env.KDEC_TEST_PSQL || 'psql'
const database='kdec_concurrency_test'
const args=['-h','127.0.0.1','-p','55439','-d',database,'-v','ON_ERROR_STOP=1','-At']
const query=sql=>execFileSync(psql,args,{input:sql,encoding:'utf8'})
execFileSync(join(dirname(psql),'createdb'),['-h','127.0.0.1','-p','55439',database])
try{
  const fixture=readFileSync(new URL('../test/sql/quarterly-fixture.sql',import.meta.url),'utf8').replace('create role anon;','').replace('create role authenticated;','')
  query(fixture)
  query(readFileSync(new URL('../MIGRATION_quarterly_scheduling.sql',import.meta.url),'utf8'))
  const scenario=readFileSync(new URL('../test/sql/quarterly-workflow.sql',import.meta.url),'utf8')
  const beforeApproval=scenario.split('select decide_schedule_replacement(slot_id,id,true)')[0]
  query(`${beforeApproval}\nreset role;commit;`)
  const [slot,attempt]=query("select slot_id,id from schedule_attempts where state='proposed'").trim().split('|')
  assert.ok(slot&&attempt)
  const sql=`begin;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);set role authenticated;select decide_schedule_replacement('${slot}','${attempt}',true);select pg_sleep(0.4);commit;`
  const execute=()=>new Promise((resolve,reject)=>{const child=execFile(psql,args,(error,stdout,stderr)=>error?reject(new Error(stderr)):resolve(stdout));child.stdin.end(sql)})
  await Promise.all([execute(),execute()])
  assert.equal(query("select count(*) from schedule_notifications where kind='replacement_assignment'").trim(),'1')
  assert.equal(query("select count(*) from schedule_slots where not leader and state='pending' and person_id is not null").trim(),'1')
  assert.equal(query("select count(*) from schedule_attempts where replacement and state='notified'").trim(),'1')
  assert.equal(query("select count(*) from service_team t join schedule_slots s on s.person_id=t.person_id and s.service_id=t.service_id where not s.leader and t.status='pending'").trim(),'1')
  console.log('Concurrent approvals: one assignment, one notification, consistent history and fresh-connection persistence passed.')
}finally{
  execFileSync(join(dirname(psql),'dropdb'),['-h','127.0.0.1','-p','55439',database])
}
