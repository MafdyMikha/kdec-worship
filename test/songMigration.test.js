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

test('song upgrade persists lyrics and inline Pro Chords through secure functions', () => {
  assert.match(sql, /create or replace function public\.upsert_song_text_content/)
  assert.match(sql, /create or replace function public\.save_song_library_entry/)
  assert.match(sql, /is_inline boolean not null default false/)
  assert.match(sql, /raw_content\s+text/)
  assert.match(sql, /p_pro_chords/)
  assert.match(sql, /revoke all on function public\.upsert_song_text_content/)
  assert.match(sql, /grant execute on function public\.save_song_library_entry[\s\S]+to authenticated/)
  assert.match(sql, /p_sequence text\[\]/)
})

test('bulk imports pass both lyrics and Pro Chords into the shared persistence path', () => {
  assert.match(sql, /perform public\.upsert_song_text_content\([\s\S]+v_item->>'lyrics'[\s\S]+v_item->>'proChords'/)
})
