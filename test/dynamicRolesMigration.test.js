import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../MIGRATION_dynamic_roles_admin.sql', import.meta.url), 'utf8')

test('dynamic-role migration creates normalized role relationships and preserves legacy snapshots', () => {
  for (const table of ['role_categories','worship_roles','profile_worship_roles','invitation_worship_roles']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`))
  }
  assert.match(sql, /refresh_profile_role_snapshot/)
  assert.match(sql, /refresh_invitation_role_snapshot/)
  assert.match(sql, /Existing text role columns remain as historical\/read-compatible snapshots/)
})

test('role administration is protected by permission checks, RLS, and audit logging', () => {
  assert.match(sql, /public\.has_permission\('roles\.manage'\)/)
  assert.match(sql, /alter table public\.worship_roles enable row level security/)
  assert.match(sql, /public\.log_admin_action\('role\.updated'/)
  assert.match(sql, /The final active Super Admin cannot be demoted or deactivated/)
})

test('role retirement uses soft disable and an optional replacement without deleting history', () => {
  assert.match(sql, /create or replace function public\.admin_set_role_status/)
  assert.match(sql, /archived_at=case when p_active then null/)
  assert.doesNotMatch(sql, /delete from public\.service_team where worship_role_id=p_role_id/)
})

test('worship role names are not used as the permanent authorization boundary', () => {
  const helper = sql.match(/create or replace function public\.can_manage_worship\(\)[\s\S]*?\$\$;/)?.[0] || ''
  assert.match(helper, /has_permission\('services\.edit'\)/)
  assert.doesNotMatch(helper, /Worship Leader|Music Director/)
})
