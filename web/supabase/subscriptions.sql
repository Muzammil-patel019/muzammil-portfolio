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

-- Upgrade existing single-plan records in place. Existing member tokens stay valid.
alter table public.subscription_plans add column if not exists id uuid not null default gen_random_uuid();
alter table public.subscription_shares drop constraint if exists subscription_shares_owner_id_fkey;
do $$ begin
  if exists(select 1 from pg_constraint where conrelid='public.subscription_plans'::regclass and conname='subscription_plans_pkey' and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id)') then
    alter table public.subscription_plans drop constraint subscription_plans_pkey;
    alter table public.subscription_plans add primary key(id);
  end if;
end $$;
create unique index if not exists subscription_plan_identity on public.subscription_plans(id,owner_id);
create index if not exists subscription_plan_owner on public.subscription_plans(owner_id);
alter table public.subscription_shares add column if not exists plan_id uuid;
update public.subscription_shares s set plan_id=p.id from public.subscription_plans p where p.owner_id=s.owner_id and s.plan_id is null;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='subscription_share_plan_identity') then
  alter table public.subscription_shares add constraint subscription_share_plan_identity foreign key(plan_id,owner_id) references public.subscription_plans(id,owner_id) on delete cascade;
 end if;
end $$;
create unique index if not exists subscription_share_member on public.subscription_shares(plan_id,member_id);
create or replace function public.fill_subscription_share_plan() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.plan_id is null then select id into new.plan_id from public.subscription_plans where owner_id=new.owner_id order by updated_at limit 1; end if;
 return new; end $$;
drop trigger if exists subscription_share_plan_default on public.subscription_shares;
create trigger subscription_share_plan_default before insert on public.subscription_shares for each row execute function public.fill_subscription_share_plan();
alter table public.subscription_shares alter column plan_id set not null;
create table if not exists public.subscription_payment_reports (
 plan_id uuid not null, owner_id uuid not null, member_id uuid not null, cycle_id uuid not null,
 opened_at timestamptz not null default now(), reported_at timestamptz,
 primary key(plan_id,member_id,cycle_id),
 foreign key(plan_id,member_id) references public.subscription_shares(plan_id,member_id) on delete cascade,
 foreign key(plan_id,owner_id) references public.subscription_plans(id,owner_id) on delete cascade
);
alter table public.subscription_payment_reports enable row level security;
drop policy if exists "report owner" on public.subscription_payment_reports;
create policy "report owner" on public.subscription_payment_reports for select to authenticated using(owner_id=auth.uid() and public.is_resume_admin());
revoke all on public.subscription_payment_reports from public,anon,authenticated;
grant select on public.subscription_payment_reports to authenticated;
create or replace function public.report_subscription_payment(token_hash text,cycle_id uuid,report_action text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare share public.subscription_shares; remaining bigint; result timestamptz;
begin
 select s.* into share from public.subscription_shares s join public.subscription_plans p on p.id=s.plan_id and p.owner_id=s.owner_id
 where s.token_hash=$1 and exists(select 1 from public.resume_admins where user_id=s.owner_id);
 if share.plan_id is null then raise exception 'Invalid link'; end if;
 select (a.value->>'amountMinor')::bigint-coalesce((select sum((r.value->>'amountMinor')::bigint) from jsonb_array_elements(a.value->'payments') r(value)),0)
 into remaining from public.subscription_plans p cross join lateral jsonb_array_elements(p.document->'cycles') c(value) cross join lateral jsonb_array_elements(c.value->'allocations') a(value)
 where p.id=share.plan_id and c.value->>'id'=$2::text and a.value->>'memberId'=share.member_id::text;
 if remaining is null or remaining<=0 then raise exception 'No outstanding balance'; end if;
 if $3='opened' then
  insert into public.subscription_payment_reports(plan_id,owner_id,member_id,cycle_id) values(share.plan_id,share.owner_id,share.member_id,$2)
  on conflict(plan_id,member_id,cycle_id) do nothing;
 elsif $3='paid' then
  update public.subscription_payment_reports set reported_at=coalesce(reported_at,now()) where plan_id=share.plan_id and member_id=share.member_id and subscription_payment_reports.cycle_id=$2 and opened_at<=now()-interval '10 seconds' returning reported_at into result;
  if result is null then raise exception 'Open payment first and wait 10 seconds'; end if;
 else raise exception 'Invalid action'; end if;
 return jsonb_build_object('reported',result is not null);
end $$;
revoke all on function public.report_subscription_payment(text,uuid,text) from public;
grant execute on function public.report_subscription_payment(text,uuid,text) to anon,authenticated;

-- The sole anonymous entry point constructs an explicit allowlist of member fields.
create or replace function public.get_subscription_share(token_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'plan', jsonb_build_object(
      'name', p.document->'plan'->>'name',
      'paymentNote', p.document->'plan'->>'paymentNote',
      'interval', p.document->'plan'->>'interval',
      'upiId', p.document->'plan'->>'upiId', 'payeeName', p.document->'plan'->>'payeeName'
    ),
    'member', jsonb_strip_nulls(jsonb_build_object('id', m.value->>'id', 'name', m.value->>'name', 'joinedDate', m.value->>'joinedDate')),
    'cycles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.value->>'id',
        'startDate', c.value->>'startDate',
        'dueDate', c.value->>'dueDate',
        'renewalDate', c.value->>'renewalDate',
        'currency', c.value->>'currency',
        'reportedAt', (select reported_at from public.subscription_payment_reports r where r.plan_id=s.plan_id and r.member_id=s.member_id and r.cycle_id=(c.value->>'id')::uuid),
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
  ))
  from public.subscription_shares s
  join public.subscription_plans p on p.id=s.plan_id and p.owner_id = s.owner_id
  cross join lateral jsonb_array_elements(p.document->'members') m(value)
  where s.token_hash = $1 and $1 ~ '^[0-9a-f]{64}$'
    and m.value->>'id' = s.member_id::text
    and exists (select 1 from public.resume_admins ra where ra.user_id = s.owner_id)
  limit 1;
$$;
revoke all on function public.get_subscription_share(text) from public;
grant execute on function public.get_subscription_share(text) to anon, authenticated;
