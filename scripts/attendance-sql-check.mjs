// In-memory PostgreSQL only: no connection string, external accounts or providers.
// Install PGlite into scratch and point KDEC_PGLITE_MODULE to dist/index.js.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { isAbsolute } from 'node:path'
const modulePath=process.env.KDEC_PGLITE_MODULE
if(!modulePath||!isAbsolute(modulePath))throw new Error('Set KDEC_PGLITE_MODULE to the absolute path of an isolated @electric-sql/pglite/dist/index.js installation.')
const moduleUrl=pathToFileURL(modulePath)
const {PGlite}=await import(moduleUrl.href)
const {uuid_ossp}=await import(new URL('./contrib/uuid_ossp.js',moduleUrl).href)
const prerequisites=['test/sql/auth-stub.sql','test/sql/storage-stub.sql','supabase-schema-FULL.sql','MIGRATION_dynamic_roles_admin.sql','MIGRATION_qa_hardening.sql','MIGRATION_song_bulk_management.sql','MIGRATION_rehearsal_before_service.sql','MIGRATION_quarterly_scheduling.sql','MIGRATION_unified_calendar.sql']
for(const legacy of [false,true]){
 const db=new PGlite({extensions:{uuid_ossp},initialMemory:128*1024*1024})
 const scenario=legacy?'existing project':'fresh project'
 try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  const files=[...prerequisites,...(legacy?['test/sql/attendance-legacy-before.sql']:[]),'MIGRATION_attendance_custom_events.sql','MIGRATION_attendance_custom_events.sql',...(legacy?['test/sql/attendance-legacy-after.sql']:['test/sql/unified-calendar-workflow.sql','test/sql/attendance-custom-workflow.sql'])]
  for(const file of files){
   let sql=await readFile(new URL(`../${file}`,import.meta.url),'utf8')
   if(legacy&&file==='supabase-schema-FULL.sql')sql=sql.split('-- BEGIN attendance/custom-events feature schema')[0]
   try{await db.exec(sql);console.log(`PASS ${scenario}: ${file}`)}
   catch(error){console.error(`FAIL ${scenario}: ${file}: ${error.message}\n${error.where||''}`);process.exitCode=1;break}
  }
 }finally{await db.close()}
 if(process.exitCode)break
}
