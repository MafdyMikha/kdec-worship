import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../MIGRATION_song_bulk_management.sql', import.meta.url), 'utf8')

test('song upgrade creates the relationships required by the live song query', () => {
  assert.match(sql, /create table if not exists public\.song_lyrics/)
  assert.match(sql, /song_id\s+uuid not null references public\.songs\(id\)/)
  assert.match(sql, /create table if not exists public\.song_charts/)
  assert.match(sql, /notify pgrst, 'reload schema'/)
})

test('song-management permission protects imports, charts, and storage', () => {
  assert.match(sql, /public\.has_permission\('songs\.manage'\)/)
  assert.doesNotMatch(sql, /not public\.is_admin\(\)/)
})
