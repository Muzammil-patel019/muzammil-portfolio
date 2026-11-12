create table if not exists public.personal_organizers(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 document jsonb not null check((jsonb_typeof(document)='object' and document->>'version'='1' and jsonb_typeof(document->'expenses')='array' and jsonb_typeof(document->'jobs')='array' and jsonb_typeof(document->'goals')='array' and jsonb_typeof(document->'notes')='array') is true),
 revision integer not null default 1 check(revision>0),updated_at timestamptz not null default now()
);
alter table public.personal_organizers enable row level security;
revoke all on public.personal_organizers from public,anon,authenticated;
grant select,insert,update on public.personal_organizers to authenticated;
drop policy if exists "organizer owner" on public.personal_organizers;
create policy "organizer owner" on public.personal_organizers for all to authenticated using(owner_id=(select auth.uid()) and public.is_resume_admin()) with check(owner_id=(select auth.uid()) and public.is_resume_admin());
