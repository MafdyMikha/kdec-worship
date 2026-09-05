-- KDEC Worship: bulk song imports, multilingual lyrics, Pro Chord charts,
-- private chart storage, and import audit history.
-- Safe for the existing live project: existing song rows and IDs are preserved.

begin;

-- Existing installations only accepted en/ar/both. Add the future-safe "other"
-- value without changing stored rows.
alter table public.songs drop constraint if exists songs_language_check;
alter table public.songs
  add constraint songs_language_check check (language in ('en','ar','both','other'));
alter table public.songs drop constraint if exists songs_bpm_range_check;
alter table public.songs add constraint songs_bpm_range_check
  check (bpm is null or bpm between 20 and 300) not valid;
alter table public.songs drop constraint if exists songs_time_signature_format_check;
alter table public.songs add constraint songs_time_signature_format_check
  check (time_signature ~ '^[0-9]{1,2}/[0-9]{1,2}$') not valid;
alter table public.songs drop constraint if exists songs_key_supported_check;
alter table public.songs add constraint songs_key_supported_check check (
  key = any(array['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B','Cm','C#m','Dbm','Dm','D#m','Ebm','Em','Fm','F#m','Gbm','Gm','G#m','Abm','Am','A#m','Bbm','Bm'])
) not valid;

create table if not exists public.song_lyrics (
  id          uuid primary key default uuid_generate_v4(),
  song_id     uuid not null references public.songs(id) on delete cascade,
  language    text not null default 'other' check (language in ('en','ar','both','other')),
  content     text not null default '',
  sections    jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  is_primary  boolean not null default false,
  version     integer not null default 1 check (version > 0),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists song_lyrics_primary_uidx
  on public.song_lyrics(song_id) where is_primary;
create index if not exists song_lyrics_song_idx on public.song_lyrics(song_id, language);
create index if not exists song_lyrics_search_idx
  on public.song_lyrics using gin (to_tsvector('simple', content));

drop trigger if exists song_lyrics_updated_at on public.song_lyrics;
create trigger song_lyrics_updated_at
  before update on public.song_lyrics
  for each row execute function public.handle_updated_at();

create table if not exists public.song_charts (
  id                uuid primary key default uuid_generate_v4(),
  song_id           uuid not null references public.songs(id) on delete cascade,
  arrangement_name  text not null default 'Original',
  chart_key         text not null default '',
  chart_type        text not null check (chart_type in ('pdf','chordpro','txt','docx','image','other')),
  notes             text not null default '',
  is_inline         boolean not null default false,
  is_primary        boolean not null default false,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists song_charts_primary_uidx
  on public.song_charts(song_id) where is_primary;
alter table public.song_charts add column if not exists is_inline boolean not null default false;
create unique index if not exists song_charts_inline_uidx
  on public.song_charts(song_id) where is_inline;
create index if not exists song_charts_song_idx on public.song_charts(song_id, created_at desc);

drop trigger if exists song_charts_updated_at on public.song_charts;
create trigger song_charts_updated_at
  before update on public.song_charts
  for each row execute function public.handle_updated_at();

create table if not exists public.song_chart_versions (
  id                 uuid primary key default uuid_generate_v4(),
  chart_id           uuid not null references public.song_charts(id) on delete cascade,
  version            integer not null check (version > 0),
  storage_path       text unique,
  original_filename text not null,
  mime_type          text not null default 'application/octet-stream',
  file_size          bigint not null default 0 check (file_size >= 0 and file_size <= 20971520),
  raw_content        text,
  parsed_data        jsonb,
  uploaded_by        uuid references public.profiles(id),
  uploaded_at        timestamptz not null default now(),
  unique(chart_id, version),
  constraint song_chart_storage_path_check check (
    storage_path is null or (
      storage_path like 'songs/%'
      and storage_path not like '%..%'
    )
  )
);

alter table public.song_chart_versions alter column storage_path drop not null;
alter table public.song_chart_versions drop constraint if exists song_chart_storage_path_check;
alter table public.song_chart_versions add constraint song_chart_storage_path_check check (
  storage_path is null or (
    storage_path like 'songs/%'
    and storage_path not like '%..%'
  )
);

create index if not exists song_chart_versions_chart_idx
  on public.song_chart_versions(chart_id, version desc);

create table if not exists public.song_import_batches (
  id             uuid primary key default uuid_generate_v4(),
  import_type    text not null check (import_type in ('songs_csv','songs_xlsx','songs_paste','charts')),
  source_name    text not null default '',
  status         text not null default 'processing' check (status in ('processing','completed','completed_with_errors','failed')),
  total_items    integer not null default 0 check (total_items >= 0),
  created_count  integer not null default 0 check (created_count >= 0),
  updated_count  integer not null default 0 check (updated_count >= 0),
  skipped_count  integer not null default 0 check (skipped_count >= 0),
  error_count    integer not null default 0 check (error_count >= 0),
  chart_count    integer not null default 0 check (chart_count >= 0),
  failed_matches integer not null default 0 check (failed_matches >= 0),
  summary        jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_by     uuid not null references public.profiles(id),
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create index if not exists song_import_batches_created_idx
  on public.song_import_batches(created_at desc);

create table if not exists public.song_import_items (
  id            uuid primary key default uuid_generate_v4(),
  batch_id      uuid not null references public.song_import_batches(id) on delete cascade,
  source_index  integer,
  source_name   text not null default '',
  action        text not null default 'skip' check (action in ('create','create_new','update','skip','upload')),
  status        text not null check (status in ('created','updated','uploaded','skipped','error')),
  song_id       uuid references public.songs(id) on delete set null,
  chart_id      uuid references public.song_charts(id) on delete set null,
  error_message text not null default '',
  details       jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at    timestamptz not null default now()
);

create index if not exists song_import_items_batch_idx
  on public.song_import_items(batch_id, source_index);

alter table public.song_lyrics          enable row level security;
alter table public.song_charts          enable row level security;
alter table public.song_chart_versions enable row level security;
alter table public.song_import_batches  enable row level security;
alter table public.song_import_items    enable row level security;

drop policy if exists "Members read song lyrics" on public.song_lyrics;
drop policy if exists "Admins manage song lyrics" on public.song_lyrics;
create policy "Members read song lyrics" on public.song_lyrics for select to authenticated
  using (public.is_active_member());
-- Lyrics are written only through the audited song-save and bulk-import RPCs.

drop policy if exists "Members read song charts" on public.song_charts;
drop policy if exists "Admins manage song charts" on public.song_charts;
drop policy if exists "Admins delete song charts" on public.song_charts;
create policy "Members read song charts" on public.song_charts for select to authenticated
  using (public.is_active_member());
create policy "Admins delete song charts" on public.song_charts for delete to authenticated
  using (public.has_permission('songs.manage'));

drop policy if exists "Members read song chart versions" on public.song_chart_versions;
drop policy if exists "Admins manage song chart versions" on public.song_chart_versions;
create policy "Members read song chart versions" on public.song_chart_versions for select to authenticated
  using (public.is_active_member());
-- Chart versions are registered only through register_song_chart; deleting a
-- chart cascades its version rows after the client removes the storage objects.

drop policy if exists "Admins read song import batches" on public.song_import_batches;
drop policy if exists "Admins create song import batches" on public.song_import_batches;
drop policy if exists "Admins update song import batches" on public.song_import_batches;
create policy "Admins read song import batches" on public.song_import_batches for select to authenticated
  using (public.has_permission('songs.manage'));
-- Import batches are created and finalized only through audited RPCs.

drop policy if exists "Admins read song import items" on public.song_import_items;
drop policy if exists "Admins create song import items" on public.song_import_items;
create policy "Admins read song import items" on public.song_import_items for select to authenticated
  using (public.has_permission('songs.manage'));
-- Import items are server-authored by the RPCs below.

-- Shared transactional writer for the primary lyrics and the manually entered
-- Pro Chords sheet. Empty text removes that content; null leaves it unchanged.
create or replace function public.upsert_song_text_content(
  p_song_id uuid,
  p_language text,
  p_lyrics text,
  p_lyrics_sections jsonb,
  p_pro_chords text,
  p_chart_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lyrics_id uuid;
  v_chart_id uuid;
  v_version integer;
begin
  if p_song_id is null or not exists(select 1 from public.songs where id=p_song_id) then
    raise exception 'Song not found' using errcode='P0002';
  end if;
  if p_language not in ('en','ar','both','other') then
    raise exception 'Unsupported song language' using errcode='22023';
  end if;
  if p_lyrics_sections is not null and jsonb_typeof(p_lyrics_sections) <> 'array' then
    raise exception 'Lyrics sections must be an array' using errcode='22023';
  end if;
  if p_lyrics is not null and char_length(p_lyrics) > 2000000 then
    raise exception 'Lyrics are limited to 2,000,000 characters' using errcode='22023';
  end if;
  if p_pro_chords is not null and char_length(p_pro_chords) > 2000000 then
    raise exception 'Pro Chords are limited to 2,000,000 characters' using errcode='22023';
  end if;

  if p_lyrics is not null then
    if btrim(p_lyrics) = '' then
      delete from public.song_lyrics where song_id=p_song_id;
    else
      update public.song_lyrics set is_primary=false where song_id=p_song_id and is_primary;
      select id into v_lyrics_id
        from public.song_lyrics
       where song_id=p_song_id and language=p_language
       order by updated_at desc limit 1
       for update;
      if v_lyrics_id is null then
        insert into public.song_lyrics(song_id,language,content,sections,is_primary,created_by)
        values(p_song_id,p_language,p_lyrics,coalesce(p_lyrics_sections,'[]'::jsonb),true,auth.uid());
      else
        update public.song_lyrics
           set content=p_lyrics,sections=coalesce(p_lyrics_sections,'[]'::jsonb),is_primary=true,version=version+1
         where id=v_lyrics_id;
      end if;
    end if;
  end if;

  if p_pro_chords is not null then
    select id into v_chart_id
      from public.song_charts
     where song_id=p_song_id and is_inline
     limit 1 for update;
    if btrim(p_pro_chords) = '' then
      if v_chart_id is not null then delete from public.song_charts where id=v_chart_id; end if;
    else
      if v_chart_id is null then
        insert into public.song_charts(song_id,arrangement_name,chart_key,chart_type,notes,is_inline,is_primary,created_by)
        values(
          p_song_id,'Manual chords',coalesce(p_chart_key,''),'txt','',true,
          not exists(select 1 from public.song_charts where song_id=p_song_id and is_primary),auth.uid()
        ) returning id into v_chart_id;
        v_version:=1;
      else
        update public.song_charts set chart_key=coalesce(p_chart_key,''),chart_type='txt' where id=v_chart_id;
        select coalesce(max(version),0)+1 into v_version from public.song_chart_versions where chart_id=v_chart_id;
      end if;
      insert into public.song_chart_versions(
        chart_id,version,storage_path,original_filename,mime_type,file_size,raw_content,parsed_data,uploaded_by
      ) values (
        v_chart_id,v_version,null,'manual-chords.txt','text/plain;charset=utf-8',octet_length(p_pro_chords),p_pro_chords,null,auth.uid()
      );
    end if;
  end if;
end;
$$;

-- One atomic save for basic song information, lyrics, and manually entered
-- chords. The client never reports success after only part of a song saved.
drop function if exists public.save_song_library_entry(uuid,text,text,text,text,integer,text,text,text[],text,text,text,jsonb,text);
create or replace function public.save_song_library_entry(
  p_song_id uuid,
  p_title text,
  p_title_ar text,
  p_author text,
  p_key text,
  p_bpm integer,
  p_time_signature text,
  p_language text,
  p_themes text[],
  p_sequence text[],
  p_notes text,
  p_ccli_number text,
  p_lyrics text,
  p_lyrics_sections jsonb,
  p_pro_chords text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_song_id uuid;
  v_user uuid:=auth.uid();
  v_old jsonb;
  v_title text:=btrim(coalesce(p_title,''));
  v_title_ar text:=btrim(coalesce(p_title_ar,''));
begin
  if v_user is null or not public.has_permission('songs.manage') then
    raise exception 'You do not have permission to manage songs' using errcode='42501';
  end if;
  if v_title='' and v_title_ar='' then raise exception 'Song title is required' using errcode='22023'; end if;
  if coalesce(p_key,'') <> all(array['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B','Cm','C#m','Dbm','Dm','D#m','Ebm','Em','Fm','F#m','Gbm','Gm','G#m','Abm','Am','A#m','Bbm','Bm']) then
    raise exception 'Choose a valid musical key' using errcode='22023';
  end if;
  if p_bpm is not null and (p_bpm<20 or p_bpm>300) then raise exception 'BPM must be between 20 and 300' using errcode='22023'; end if;
  if coalesce(p_time_signature,'') !~ '^[0-9]{1,2}/[0-9]{1,2}$' then raise exception 'Invalid time signature' using errcode='22023'; end if;
  if p_language not in ('en','ar','both') then raise exception 'Unsupported song language' using errcode='22023'; end if;

  if p_song_id is null then
    insert into public.songs(title,title_ar,author,key,bpm,time_signature,language,themes,sequence,notes,ccli_number,usage_count,status,created_by)
    values(
      coalesce(nullif(v_title,''),v_title_ar),v_title_ar,btrim(coalesce(p_author,'')),p_key,p_bpm,p_time_signature,p_language,
      coalesce(p_themes,'{}'::text[]),case when jsonb_array_length(coalesce(p_lyrics_sections,'[]'::jsonb))>0
        then array(select section->>'label' from jsonb_array_elements(p_lyrics_sections) section where coalesce(section->>'label','')<>'')
        else coalesce(p_sequence,'{}'::text[]) end,
      coalesce(p_notes,''),btrim(coalesce(p_ccli_number,'')),0,'active',v_user
    ) returning id into v_song_id;
  else
    select to_jsonb(song) into v_old from public.songs song where song.id=p_song_id for update;
    if v_old is null then raise exception 'Song not found' using errcode='P0002'; end if;
    update public.songs set
      title=coalesce(nullif(v_title,''),v_title_ar),title_ar=v_title_ar,author=btrim(coalesce(p_author,'')),key=p_key,bpm=p_bpm,
      time_signature=p_time_signature,language=p_language,themes=coalesce(p_themes,'{}'::text[]),
      sequence=case when jsonb_array_length(coalesce(p_lyrics_sections,'[]'::jsonb))>0
        then array(select section->>'label' from jsonb_array_elements(p_lyrics_sections) section where coalesce(section->>'label','')<>'')
        else coalesce(p_sequence,'{}'::text[]) end,
      notes=coalesce(p_notes,''),ccli_number=btrim(coalesce(p_ccli_number,'')),status='active'
    where id=p_song_id;
    v_song_id:=p_song_id;
  end if;

  perform public.upsert_song_text_content(v_song_id,p_language,p_lyrics,coalesce(p_lyrics_sections,'[]'::jsonb),p_pro_chords,p_key);
  perform public.log_admin_action(case when p_song_id is null then 'song.created' else 'song.updated' end,'song',v_song_id::text,v_old,(select to_jsonb(song) from public.songs song where song.id=v_song_id));
  return v_song_id;
end;
$$;

create or replace function public.bulk_import_songs(
  p_items jsonb,
  p_source_name text default '',
  p_import_type text default 'songs_csv'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_batch_id uuid;
  v_item jsonb;
  v_song_id uuid;
  v_action text;
  v_title text;
  v_language text;
  v_source_index integer;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_errors integer := 0;
  v_total integer := 0;
begin
  if v_user is null or not public.has_permission('songs.manage') then
    raise exception 'You do not have permission to bulk import songs' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Import items must be a JSON array' using errcode = '22023';
  end if;
  if p_import_type not in ('songs_csv','songs_xlsx','songs_paste') then
    raise exception 'Unsupported song import type' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 1000 then
    raise exception 'A single import is limited to 1000 rows' using errcode = '22023';
  end if;

  v_total := jsonb_array_length(p_items);
  insert into public.song_import_batches (import_type, source_name, total_items, created_by)
  values (p_import_type, left(coalesce(p_source_name,''), 240), v_total, v_user)
  returning id into v_batch_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_action := coalesce(nullif(v_item->>'action',''), 'skip');
    v_title := trim(coalesce(v_item->>'title',''));
    v_source_index := null;
    v_song_id := null;
    begin
      v_source_index := nullif(v_item->>'sourceRow','')::integer;
      if jsonb_typeof(v_item->'errors') = 'array' and jsonb_array_length(v_item->'errors') > 0 then
        raise exception '%', coalesce(v_item->'errors'->>0, 'Invalid import row') using errcode = '22023';
      end if;
      if v_action = 'skip' then
        v_skipped := v_skipped + 1;
        insert into public.song_import_items (batch_id, source_index, source_name, action, status, song_id, details)
        values (v_batch_id, v_source_index, v_title, 'skip', 'skipped', nullif(v_item->>'matchedSongId','')::uuid, jsonb_build_object('reason',coalesce(v_item->>'matchReason','')));
        continue;
      end if;
      if v_title = '' then
        raise exception 'Missing song title' using errcode = '22023';
      end if;
      if v_action not in ('create','create_new','update') then
        raise exception 'Unsupported import action: %', v_action using errcode = '22023';
      end if;

      v_language := coalesce(nullif(v_item->>'language',''), 'other');
      if v_language not in ('en','ar','both','other') then
        raise exception 'Unsupported language: %', v_language using errcode = '22023';
      end if;

      if v_action = 'update' then
        v_song_id := nullif(v_item->>'matchedSongId','')::uuid;
        if v_song_id is null then raise exception 'Select an existing song to update'; end if;
        update public.songs as target
           set title = coalesce(nullif(v_item->>'title',''), target.title),
               title_ar = case
                 when nullif(v_item->>'arabicTitle','') is not null then v_item->>'arabicTitle'
                 when v_language = 'ar' and target.title_ar = '' then v_title
                 else target.title_ar
               end,
               author = coalesce(nullif(v_item->>'artist',''), target.author),
               key = coalesce(nullif(v_item->>'key',''), target.key),
               bpm = coalesce(nullif(v_item->>'bpm','')::integer, target.bpm),
               time_signature = coalesce(nullif(v_item->>'timeSignature',''), target.time_signature),
               language = v_language,
               themes = case when jsonb_array_length(coalesce(v_item->'tags','[]'::jsonb)) > 0
                         then array(select jsonb_array_elements_text(v_item->'tags')) else target.themes end,
               notes = coalesce(nullif(v_item->>'notes',''), target.notes),
               ccli_number = coalesce(nullif(v_item->>'ccliNumber',''), target.ccli_number),
               status = 'active'
         where target.id = v_song_id;
        if not found then raise exception 'The selected song no longer exists'; end if;
      else
        insert into public.songs (
          title, title_ar, author, key, bpm, time_signature, language,
          themes, sequence, notes, ccli_number, usage_count, status, created_by
        ) values (
          v_title,
          case when nullif(v_item->>'arabicTitle','') is not null then v_item->>'arabicTitle' when v_language='ar' then v_title else '' end,
          coalesce(v_item->>'artist',''), coalesce(nullif(v_item->>'key',''),'G'),
          nullif(v_item->>'bpm','')::integer, coalesce(nullif(v_item->>'timeSignature',''),'4/4'), v_language,
          array(select jsonb_array_elements_text(coalesce(v_item->'tags','[]'::jsonb))),
          array(select section->>'label' from jsonb_array_elements(coalesce(v_item->'lyricSections','[]'::jsonb)) section where section->>'label' <> ''),
          coalesce(v_item->>'notes',''), coalesce(v_item->>'ccliNumber',''), 0, 'active', v_user
        ) returning id into v_song_id;
      end if;

      perform public.upsert_song_text_content(
        v_song_id,v_language,
        case when btrim(coalesce(v_item->>'lyrics',''))<>'' then v_item->>'lyrics' else null end,
        coalesce(v_item->'lyricSections','[]'::jsonb),
        case when btrim(coalesce(v_item->>'proChords',''))<>'' then v_item->>'proChords' else null end,
        coalesce(nullif(v_item->>'key',''),'G')
      );
      if v_action='update' then v_updated:=v_updated+1; else v_created:=v_created+1; end if;

      insert into public.song_import_items (batch_id, source_index, source_name, action, status, song_id, details)
      values (v_batch_id, v_source_index, v_title, v_action, case when v_action='update' then 'updated' else 'created' end, v_song_id,
              jsonb_build_object('language',v_language,'hasLyrics',coalesce(v_item->>'lyrics','')<>'','hasProChords',coalesce(v_item->>'proChords','')<>''));
    exception when others then
      v_errors := v_errors + 1;
      v_song_id := null;
      insert into public.song_import_items (batch_id, source_index, source_name, action, status, song_id, error_message, details)
      values (v_batch_id, v_source_index, v_title, case when v_action in ('create','create_new','update','skip') then v_action else 'skip' end,
              'error', v_song_id, sqlerrm, jsonb_build_object('sqlstate',sqlstate));
    end;
  end loop;

  update public.song_import_batches
     set status = case when v_errors > 0 then 'completed_with_errors' else 'completed' end,
         created_count = v_created, updated_count = v_updated, skipped_count = v_skipped,
         error_count = v_errors,
         summary = jsonb_build_object('processed',v_total,'created',v_created,'updated',v_updated,'skipped',v_skipped,'errors',v_errors),
         completed_at = now()
   where id = v_batch_id;

  return jsonb_build_object('batchId',v_batch_id,'processed',v_total,'created',v_created,'updated',v_updated,'skipped',v_skipped,'errors',v_errors);
end;
$$;

create or replace function public.start_song_chart_import(p_source_name text, p_total integer)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_batch_id uuid;
begin
  if auth.uid() is null or not public.has_permission('songs.manage') then raise exception 'You do not have permission to upload song charts' using errcode='42501'; end if;
  if p_total < 1 or p_total > 250 then raise exception 'Chart imports must contain 1 to 250 files' using errcode='22023'; end if;
  insert into public.song_import_batches(import_type,source_name,total_items,created_by)
  values('charts',left(coalesce(p_source_name,''),240),p_total,auth.uid()) returning id into v_batch_id;
  return v_batch_id;
end;
$$;

create or replace function public.register_song_chart(
  p_batch_id uuid, p_song_id uuid, p_arrangement_name text, p_chart_key text,
  p_chart_type text, p_notes text, p_is_primary boolean, p_storage_path text,
  p_original_filename text, p_mime_type text, p_file_size bigint,
  p_raw_content text default null, p_parsed_data jsonb default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_chart_id uuid; v_version integer;
begin
  if auth.uid() is null or not public.has_permission('songs.manage') then raise exception 'You do not have permission to upload song charts' using errcode='42501'; end if;
  if not exists(select 1 from public.song_import_batches where id=p_batch_id and created_by=auth.uid() and status='processing') then raise exception 'Chart import batch is not active'; end if;
  if not exists(select 1 from public.songs where id=p_song_id and status='active') then raise exception 'Select an active song'; end if;
  if p_chart_type not in ('pdf','chordpro','txt','docx','image','other') then raise exception 'Unsupported chart type'; end if;
  if p_storage_path not like 'songs/%' or p_storage_path like '%..%' then raise exception 'Invalid chart storage path'; end if;
  if p_file_size < 0 or p_file_size > 20971520 then raise exception 'Chart files are limited to 20 MB'; end if;

  if coalesce(p_is_primary,false) then update public.song_charts set is_primary=false where song_id=p_song_id and is_primary; end if;
  insert into public.song_charts(song_id,arrangement_name,chart_key,chart_type,notes,is_primary,created_by)
  values(p_song_id,coalesce(nullif(trim(p_arrangement_name),''),'Original'),coalesce(p_chart_key,''),p_chart_type,coalesce(p_notes,''),coalesce(p_is_primary,false),auth.uid())
  returning id into v_chart_id;
  v_version := 1;
  insert into public.song_chart_versions(chart_id,version,storage_path,original_filename,mime_type,file_size,raw_content,parsed_data,uploaded_by)
  values(v_chart_id,v_version,p_storage_path,p_original_filename,coalesce(p_mime_type,'application/octet-stream'),p_file_size,p_raw_content,p_parsed_data,auth.uid());
  insert into public.song_import_items(batch_id,source_name,action,status,song_id,chart_id,details)
  values(p_batch_id,p_original_filename,'upload','uploaded',p_song_id,v_chart_id,jsonb_build_object('key',coalesce(p_chart_key,''),'storagePath',p_storage_path));
  return jsonb_build_object('chartId',v_chart_id,'version',v_version);
end;
$$;

create or replace function public.finish_song_chart_import(p_batch_id uuid, p_errors integer, p_failed_matches integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uploaded integer; v_total integer;
begin
  if auth.uid() is null or not public.has_permission('songs.manage') then raise exception 'You do not have permission to finish chart imports' using errcode='42501'; end if;
  select total_items into v_total from public.song_import_batches where id=p_batch_id and created_by=auth.uid() and status='processing' for update;
  if not found then raise exception 'Chart import batch is not active'; end if;
  select count(*) into v_uploaded from public.song_import_items where batch_id=p_batch_id and status='uploaded';
  update public.song_import_batches set
    status=case when coalesce(p_errors,0)>0 or coalesce(p_failed_matches,0)>0 then 'completed_with_errors' else 'completed' end,
    chart_count=v_uploaded, error_count=greatest(coalesce(p_errors,0),0), failed_matches=greatest(coalesce(p_failed_matches,0),0),
    skipped_count=greatest(v_total-v_uploaded-greatest(coalesce(p_errors,0),0),0),
    summary=jsonb_build_object('processed',v_total,'uploaded',v_uploaded,'errors',greatest(coalesce(p_errors,0),0),'failedMatches',greatest(coalesce(p_failed_matches,0),0)),
    completed_at=now()
  where id=p_batch_id;
  return jsonb_build_object('batchId',p_batch_id,'processed',v_total,'uploaded',v_uploaded,'errors',greatest(coalesce(p_errors,0),0),'failedMatches',greatest(coalesce(p_failed_matches,0),0));
end;
$$;

create or replace function public.record_song_chart_import_error(
  p_batch_id uuid, p_source_name text, p_error_message text, p_song_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_item_id uuid;
begin
  if auth.uid() is null or not public.has_permission('songs.manage') then raise exception 'You do not have permission to record chart imports' using errcode='42501'; end if;
  if not exists(select 1 from public.song_import_batches where id=p_batch_id and created_by=auth.uid() and status='processing') then raise exception 'Chart import batch is not active'; end if;
  insert into public.song_import_items(batch_id,source_name,action,status,song_id,error_message)
  values(p_batch_id,left(coalesce(p_source_name,''),240),'upload','error',p_song_id,left(coalesce(p_error_message,'Upload failed'),1000))
  returning id into v_item_id;
  return v_item_id;
end;
$$;

revoke all on function public.upsert_song_text_content(uuid,text,text,jsonb,text,text) from public;
revoke all on function public.save_song_library_entry(uuid,text,text,text,text,integer,text,text,text[],text[],text,text,text,jsonb,text) from public;
revoke all on function public.bulk_import_songs(jsonb,text,text) from public;
revoke all on function public.start_song_chart_import(text,integer) from public;
revoke all on function public.register_song_chart(uuid,uuid,text,text,text,text,boolean,text,text,text,bigint,text,jsonb) from public;
revoke all on function public.finish_song_chart_import(uuid,integer,integer) from public;
revoke all on function public.record_song_chart_import_error(uuid,text,text,uuid) from public;
grant execute on function public.save_song_library_entry(uuid,text,text,text,text,integer,text,text,text[],text[],text,text,text,jsonb,text) to authenticated;
grant execute on function public.bulk_import_songs(jsonb,text,text) to authenticated;
grant execute on function public.start_song_chart_import(text,integer) to authenticated;
grant execute on function public.register_song_chart(uuid,uuid,text,text,text,text,boolean,text,text,text,bigint,text,jsonb) to authenticated;
grant execute on function public.finish_song_chart_import(uuid,integer,integer) to authenticated;
grant execute on function public.record_song_chart_import_error(uuid,text,text,uuid) to authenticated;

-- Private Supabase Storage bucket. The database stores only paths and metadata,
-- never large binaries.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'song-charts','song-charts',false,20971520,
  array['application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg','image/webp','application/octet-stream']
)
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Members read song chart files" on storage.objects;
drop policy if exists "Admins upload song chart files" on storage.objects;
drop policy if exists "Admins update song chart files" on storage.objects;
drop policy if exists "Admins delete song chart files" on storage.objects;
create policy "Members read song chart files" on storage.objects for select to authenticated
  using (bucket_id='song-charts' and public.is_active_member());
create policy "Admins upload song chart files" on storage.objects for insert to authenticated
  with check (bucket_id='song-charts' and public.has_permission('songs.manage') and (storage.foldername(name))[1]='songs');
create policy "Admins update song chart files" on storage.objects for update to authenticated
  using (bucket_id='song-charts' and public.has_permission('songs.manage')) with check (bucket_id='song-charts' and public.has_permission('songs.manage'));
create policy "Admins delete song chart files" on storage.objects for delete to authenticated
  using (bucket_id='song-charts' and public.has_permission('songs.manage'));

-- Make newly created foreign-key relationships available to PostgREST
-- immediately after the SQL Editor transaction commits.
notify pgrst, 'reload schema';

commit;
