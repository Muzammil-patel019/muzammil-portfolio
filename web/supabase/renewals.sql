create table if not exists public.renewal_trackers(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 document jsonb not null check((jsonb_typeof(document)='object' and document->>'version'='1' and jsonb_typeof(document->'items')='array') is true),
 revision integer not null default 1 check(revision>0),updated_at timestamptz not null default now()
);
alter table public.renewal_trackers enable row level security;
revoke all on public.renewal_trackers from public,anon,authenticated;
grant select,insert,update on public.renewal_trackers to authenticated;
drop policy if exists "renewal tracker owner" on public.renewal_trackers;
create policy "renewal tracker owner" on public.renewal_trackers for all to authenticated using(owner_id=(select auth.uid()) and public.is_resume_admin()) with check(owner_id=(select auth.uid()) and public.is_resume_admin());
