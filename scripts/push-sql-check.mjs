// In-memory PostgreSQL only, using synthetic accounts and no provider calls.
// Supply an isolated PGlite installation; npm test stays dependency-free.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { isAbsolute } from 'node:path'
const path = process.env.KDEC_PGLITE_MODULE
if (!path || !isAbsolute(path)) throw new Error('Set KDEC_PGLITE_MODULE to an isolated @electric-sql/pglite/dist/index.js installation.')
const moduleUrl = pathToFileURL(path)
const { PGlite } = await import(moduleUrl.href)
const { uuid_ossp } = await import(new URL('./contrib/uuid_ossp.js', moduleUrl).href)
const prerequisites = ['test/sql/auth-stub.sql', 'test/sql/storage-stub.sql', 'supabase-schema-FULL.sql', 'MIGRATION_dynamic_roles_admin.sql', 'MIGRATION_qa_hardening.sql', 'MIGRATION_song_bulk_management.sql', 'MIGRATION_rehearsal_before_service.sql', 'MIGRATION_quarterly_scheduling.sql', 'MIGRATION_unified_calendar.sql', 'MIGRATION_attendance_custom_events.sql']
for (const existing of [false, true]) {
  const db = new PGlite({ extensions: { uuid_ossp } })
  let failure = null
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
    for (const file of [...prerequisites, 'MIGRATION_web_push.sql', 'MIGRATION_web_push.sql', 'test/sql/push-workflow.sql']) {
      let sql = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
      if (existing && file === 'supabase-schema-FULL.sql') sql = sql.split('-- BEGIN web-push feature schema')[0]
      try { await db.exec(sql); console.log(`PASS ${existing ? 'upgrade' : 'fresh'}: ${file}`) }
      catch (error) { console.error(`FAIL ${file}: ${error.message}\n${error.where || ''}`); failure = error; break }
    }
  } finally { await db.close() }
  if (failure) throw failure
}
