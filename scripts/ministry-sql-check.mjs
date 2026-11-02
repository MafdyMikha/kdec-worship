// Optional isolated PostgreSQL integration check. npm test needs no service.
import {readFile} from 'node:fs/promises'
import {isAbsolute} from 'node:path'
import {pathToFileURL} from 'node:url'
const modulePath=process.env.KDEC_PGLITE_MODULE
if(!modulePath||!isAbsolute(modulePath))throw new Error('Set KDEC_PGLITE_MODULE to an isolated @electric-sql/pglite/dist/index.js installation.')
const moduleUrl=pathToFileURL(modulePath)
const {PGlite}=await import(moduleUrl.href)
const {uuid_ossp}=await import(new URL('./contrib/uuid_ossp.js',moduleUrl).href)
const prerequisites=['MIGRATION_dynamic_roles_admin.sql','MIGRATION_qa_hardening.sql','MIGRATION_song_bulk_management.sql','MIGRATION_rehearsal_before_service.sql','MIGRATION_quarterly_scheduling.sql','MIGRATION_unified_calendar.sql','MIGRATION_attendance_custom_events.sql']
for(const upgrade of [false,true]){
 const db=new PGlite({extensions:{uuid_ossp}})
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;')
  const files=['test/sql/auth-stub.sql','test/sql/storage-stub.sql','supabase-schema-FULL.sql',...(upgrade?prerequisites:[]),'MIGRATION_ministry_insights.sql','MIGRATION_ministry_insights.sql','test/sql/ministry-workflow.sql']
  for(const file of files){
   let sql=await readFile(new URL(`../${file}`,import.meta.url),'utf8')
   if(upgrade&&file==='supabase-schema-FULL.sql')sql=sql.split('-- BEGIN ministry feature prerequisites')[0]
   try{await db.exec(sql);console.log(`PASS ${upgrade?'upgrade':'fresh'}: ${file}`)}
   catch(error){throw new Error(`${upgrade?'upgrade':'fresh'} ${file}: ${error.message}\n${error.where||''}`)}
  }
 }finally{await db.close()}
}
