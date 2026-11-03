-- Run after schema.sql. This feature uses the same owner account as the resume builder.
-- Member links are capabilities. Original tokens are owner-only for repeat sharing;
-- the anonymous RPC uses the hash and never returns tokens.
create table if not exists public.subscription_plans (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.subscription_plans enable row level security;
drop policy if exists "subscription owner" on public.subscription_plans;
create policy "subscription owner" on public.subscription_plans for all to authenticated
  using (owner_id = auth.uid() and public.is_resume_admin())
  with check (owner_id = auth.uid() and public.is_resume_admin());
drop trigger if exists subscription_updated on public.subscription_plans;
create trigger subscription_updated before update on public.subscription_plans
  for each row execute function public.touch_resume();
revoke all on public.subscription_plans from public, anon, authenticated;
grant select, insert, update, delete on public.subscription_plans to authenticated;

create table if not exists public.subscription_shares (
  owner_id uuid not null references public.subscription_plans(owner_id) on delete cascade,
  member_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id)
);
alter table public.subscription_shares add column if not exists owner_token text check (owner_token is null or owner_token ~ '^[A-Za-z0-9_-]{43}$');
alter table public.subscription_shares enable row level security;
drop policy if exists "subscription share owner" on public.subscription_shares;
create policy "subscription share owner" on public.subscription_shares for all to authenticated
  using (owner_id = auth.uid() and public.is_resume_admin())
  with check (owner_id = auth.uid() and public.is_resume_admin());
revoke all on public.subscription_shares from public, anon, authenticated;
grant select, insert, update, delete on public.subscription_shares to authenticated;

-- The sole anonymous entry point constructs an explicit allowlist of member fields.
create or replace function public.get_subscription_share(token_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plan', jsonb_build_object(
      'name', p.document->'plan'->>'name',
      'paymentNote', p.document->'plan'->>'paymentNote',
      'interval', p.document->'plan'->>'interval'
    ),
    'member', jsonb_strip_nulls(jsonb_build_object('id', m.value->>'id', 'name', m.value->>'name', 'joinedDate', m.value->>'joinedDate')),
    'cycles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.value->>'id',
        'startDate', c.value->>'startDate',
        'dueDate', c.value->>'dueDate',
        'renewalDate', c.value->>'renewalDate',
        'currency', c.value->>'currency',
        'amountMinor', a.value->'amountMinor',
        'payments', coalesce((
          select jsonb_agg(jsonb_build_object('amountMinor', payment.value->'amountMinor', 'date', payment.value->>'date') order by payment.ordinality)
          from jsonb_array_elements(a.value->'payments') with ordinality as payment(value, ordinality)
        ), '[]'::jsonb)
      ) order by (c.value->>'index')::integer)
      from jsonb_array_elements(p.document->'cycles') c(value)
      cross join lateral jsonb_array_elements(c.value->'allocations') a(value)
      where a.value->>'memberId' = s.member_id::text
    ), '[]'::jsonb)
  )
  from public.subscription_shares s
  join public.subscription_plans p on p.owner_id = s.owner_id
  cross join lateral jsonb_array_elements(p.document->'members') m(value)
  where s.token_hash = $1 and $1 ~ '^[0-9a-f]{64}$'
    and m.value->>'id' = s.member_id::text
    and exists (select 1 from public.resume_admins ra where ra.user_id = s.owner_id)
  limit 1;
$$;
revoke all on function public.get_subscription_share(text) from public;
grant execute on function public.get_subscription_share(text) to anon, authenticated;
