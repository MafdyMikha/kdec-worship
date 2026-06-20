-- ════════════════════════════════════════════════════════════
-- Migration: Multi-Role Support
-- Run this in Supabase → SQL Editor → New Query → Run
-- ════════════════════════════════════════════════════════════

-- Add `roles` array column to profiles (a person can now have multiple roles)
alter table profiles
  add column if not exists roles jsonb default '[]'::jsonb;

-- Add `roles` array column to invitations (admin can invite with multiple roles)
alter table invitations
  add column if not exists roles jsonb default '[]'::jsonb;

-- Backfill: copy each person's existing single `role` into the new `roles` array
-- so nobody loses their current role assignment
update profiles
  set roles = jsonb_build_array(role)
  where (roles is null or roles = '[]'::jsonb) and role is not null and role <> '';

update invitations
  set roles = jsonb_build_array(role)
  where (roles is null or roles = '[]'::jsonb) and role is not null and role <> '';

-- Done ✅
-- The `role` column is kept as-is (it now always stores the FIRST/primary role)
-- for backward compatibility with badge colors, filters, and substitute matching.
