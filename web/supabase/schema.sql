-- Run in the Supabase SQL editor. Never put a service-role key in this app.
create table if not exists public.resume_admins (user_id uuid primary key references auth.users(id));
alter table public.resume_admins enable row level security;
revoke all on public.resume_admins from anon, authenticated;
create or replace function public.is_resume_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.resume_admins where user_id = auth.uid());
$$;
revoke all on function public.is_resume_admin() from public;
grant execute on function public.is_resume_admin() to authenticated;
create table if not exists public.resume_versions (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 name text not null check(char_length(name) between 1 and 120),kind text not null check(kind in ('master','tailored')),
 document jsonb not null,updated_at timestamptz not null default now()
);
alter table public.resume_versions enable row level security;
create policy "owner only" on public.resume_versions for all to authenticated
 using (owner_id = auth.uid() and public.is_resume_admin())
 with check (owner_id = auth.uid() and public.is_resume_admin());
create or replace function public.touch_resume() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger resume_updated before update on public.resume_versions for each row execute function public.touch_resume();
create table if not exists public.published_resume (
 id integer primary key check(id=1),document jsonb not null,published_by uuid references auth.users(id),published_at timestamptz not null default now()
);
alter table public.published_resume enable row level security;
create policy "public read" on public.published_resume for select to anon,authenticated using(true);
create policy "owner publish" on public.published_resume for all to authenticated using(public.is_resume_admin()) with check(public.is_resume_admin() and published_by=auth.uid());
revoke all on public.resume_versions from anon, authenticated;
grant select,insert,update,delete on public.resume_versions to authenticated;
revoke all on public.published_resume from anon, authenticated;
grant select on public.published_resume to anon,authenticated;
grant insert,update on public.published_resume to authenticated;
-- After creating your Auth user, run (replace with your real user UUID):
-- insert into public.resume_admins(user_id) values ('YOUR_AUTH_USER_UUID');
