-- Private owner-only tracker. No anonymous table grants or public sharing RPCs.
create table if not exists public.card_trackers (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 document jsonb not null check(jsonb_typeof(document)='object' and document->>'version'='1' and jsonb_typeof(document->'cards')='array' and jsonb_typeof(document->'statements')='array'),
 revision integer not null default 1 check(revision>0),updated_at timestamptz not null default now()
);
alter table public.card_trackers enable row level security;
revoke all on public.card_trackers from public,anon,authenticated;
grant select,insert,update on public.card_trackers to authenticated;
drop policy if exists "card tracker owner" on public.card_trackers;
create policy "card tracker owner" on public.card_trackers for all to authenticated using(owner_id=(select auth.uid()) and public.is_resume_admin()) with check(owner_id=(select auth.uid()) and public.is_resume_admin());
