// Keep the fresh-install schema self-contained and the extension byte-identical
// to its upgrade migration. No database connection or credentials are used.
import {readFileSync,writeFileSync} from 'node:fs'
const root=new URL('../',import.meta.url)
const schema=new URL('supabase-schema-FULL.sql',root)
const marker='-- BEGIN ministry feature prerequisites'
const files=['MIGRATION_dynamic_roles_admin.sql','MIGRATION_qa_hardening.sql','MIGRATION_song_bulk_management.sql','MIGRATION_rehearsal_before_service.sql','MIGRATION_quarterly_scheduling.sql','MIGRATION_unified_calendar.sql','MIGRATION_attendance_custom_events.sql']
const base=readFileSync(schema,'utf8').split(marker)[0].trimEnd()
const prerequisites=files.map(file=>`-- Bundled fresh-install prerequisite: ${file}\n${readFileSync(new URL(file,root),'utf8').trimEnd()}`).join('\n\n')
const extension=readFileSync(new URL('MIGRATION_ministry_insights.sql',root),'utf8').trimEnd()
writeFileSync(schema,`${base}\n\n${marker}\n-- Fresh projects need no separate historical workflow migrations.\n${prerequisites}\n-- END ministry feature prerequisites\n\n-- BEGIN ministry insights feature schema\n${extension}\n-- END ministry insights feature schema\n`)
console.log('Fresh-install schema synchronized.')
