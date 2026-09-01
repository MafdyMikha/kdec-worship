import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql=readFileSync(new URL('../MIGRATION_qa_hardening.sql',import.meta.url),'utf8')

test('full profiles require ownership or users.view and the safe directory omits private fields',()=>{
  assert.match(sql,/id = auth\.uid\(\) or public\.has_permission\('users\.view'\)/)
  const directory=sql.match(/create or replace function public\.get_member_directory\(\)[\s\S]*?\$\$;/)?.[0]||''
  assert.match(directory,/profile\.name/)
  assert.match(directory,/profile\.roles/)
  for(const privateField of ['email','phone','whatsapp','notes','availability','access_level','is_admin','last_active_at']) {
    assert.doesNotMatch(directory,new RegExp(`profile\\.${privateField}`))
  }
})

test('database constraints reject blank titles and malformed invitation email',()=>{
  for(const constraint of ['songs_title_not_blank','services_title_not_blank','events_title_not_blank','announcements_title_not_blank','announcements_content_not_blank']) assert.match(sql,new RegExp(constraint))
  assert.match(sql,/invitations_email_format_check/)
  assert.match(sql,/A pending invitation already exists for this email/)
})

test('attendance schedule trigger derives expiry and rejects expired one-time sessions',()=>{
  assert.match(sql,/create or replace function public\.guard_attendance_session_schedule/)
  assert.match(sql,/at time zone v_timezone/)
  assert.match(sql,/v_expiry<=now\(\)/)
  assert.match(sql,/if new\.repeatable then return new/)
})
