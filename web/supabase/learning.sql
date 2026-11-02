-- Apply after schema.sql. Private learning records; never publicly readable.
create table public.learning_progress (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 document jsonb not null,
 revision integer not null default 1
);
alter table public.learning_progress enable row level security;
create policy "private learning" on public.learning_progress for all to authenticated
 using (owner_id = auth.uid() and public.is_resume_admin())
 with check (owner_id = auth.uid() and public.is_resume_admin());
revoke all on public.learning_progress from anon, authenticated;
grant select, insert, update on public.learning_progress to authenticated;
