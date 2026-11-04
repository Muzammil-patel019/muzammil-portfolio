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
alter table public.subscription_shares add column if not exists owner_code text unique check (owner_code is null or owner_code ~ '^[A-Za-z0-9_-]{22}$');
alter table public.subscription_shares add column if not exists code_hash text unique check (code_hash is null or code_hash ~ '^[0-9a-f]{64}$');
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
 where (s.token_hash=$1 or s.code_hash=$1) and exists(select 1 from public.resume_admins where user_id=s.owner_id);
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

alter table public.subscription_payment_reports add column if not exists term_months integer check(term_months in (1,3,6,12));
alter table public.subscription_payment_reports add column if not exists amount_minor bigint;
alter table public.subscription_payment_reports add column if not exists coverage_end date;
alter table public.subscription_payment_reports add column if not exists preference_at timestamptz;
alter table public.subscription_payment_reports add column if not exists approved_months integer;
alter table public.subscription_payment_reports add column if not exists payment_opened_at timestamptz;
alter table public.subscription_payment_reports add column if not exists confirmed_at timestamptz;
update public.subscription_payment_reports set payment_opened_at=opened_at where term_months is null and reported_at is not null and payment_opened_at is null;
drop policy if exists "report owner update" on public.subscription_payment_reports;
create policy "report owner update" on public.subscription_payment_reports for update to authenticated using(owner_id=auth.uid() and public.is_resume_admin()) with check(owner_id=auth.uid() and public.is_resume_admin());
grant update on public.subscription_payment_reports to authenticated;
create or replace function public.save_subscription_plan(plan_id uuid,expected_revision integer,plan_document jsonb,confirm_member uuid default null,confirm_cycle uuid default null,confirm_reported timestamptz default null) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare new_revision integer;
begin
 update public.subscription_plans set document=$3,revision=revision+1 where id=$1 and owner_id=auth.uid() and revision=$2 returning revision into new_revision;
 if new_revision is null then return null; end if;
 if $4 is not null and $5 is not null then update public.subscription_payment_reports set confirmed_at=now() where plan_id=$1 and owner_id=auth.uid() and member_id=$4 and cycle_id=$5 and reported_at=$6; end if;
 return jsonb_build_object('id',$1,'revision',new_revision);
end $$;
revoke all on function public.save_subscription_plan(uuid,integer,jsonb,uuid,uuid,timestamptz) from public,anon;
grant execute on function public.save_subscription_plan(uuid,integer,jsonb,uuid,uuid,timestamptz) to authenticated;
create or replace function public.report_subscription_coverage(token_hash text,cycle_id uuid,report_action text,months integer) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare share public.subscription_shares; allocation jsonb; billing jsonb; base_months integer; quoted bigint; quote_end date; paid bigint; existing public.subscription_payment_reports;
begin
 if $4 is null or $4 not in (1,3,6,12) then raise exception 'Choose 1,3,6 or 12 months'; end if;
 select s.* into share from public.subscription_shares s join public.subscription_plans p on p.id=s.plan_id and p.owner_id=s.owner_id where (s.token_hash=$1 or s.code_hash=$1) and exists(select 1 from public.resume_admins where user_id=s.owner_id);
 if share.plan_id is null then raise exception 'Invalid link'; end if;
 select c.value,a.value into billing,allocation from public.subscription_plans p cross join lateral jsonb_array_elements(p.document->'cycles') c(value) cross join lateral jsonb_array_elements(c.value->'allocations') a(value) where p.id=share.plan_id and c.value->>'id'=$2::text and a.value->>'memberId'=share.member_id::text;
 if allocation is null then raise exception 'Invalid billing period'; end if;
 base_months=greatest(1,(extract(year from (billing->>'renewalDate')::date)::integer-extract(year from (billing->>'startDate')::date)::integer)*12+extract(month from (billing->>'renewalDate')::date)::integer-extract(month from (billing->>'startDate')::date)::integer);
 select coalesce(sum((r.value->>'amountMinor')::bigint),0) into paid from jsonb_array_elements(allocation->'payments') r(value);
 quoted=greatest(0,round((allocation->>'amountMinor')::numeric*$4/base_months)::bigint-paid-coalesce((select sum((credit.value->>'remainingMinor')::bigint) from public.subscription_plans p cross join lateral jsonb_array_elements(coalesce(p.document->'credits','[]'::jsonb)) credit(value) where p.id=share.plan_id and credit.value->>'memberId'=share.member_id::text and credit.value->>'currency'=billing->>'currency' and credit.value->>'startDate'<=billing->>'startDate'),0));
 if (quoted<=0 and $3<>'preference') or quoted>100000000 then raise exception 'Selected coverage is already paid or exceeds the payment limit'; end if;
 quote_end=((billing->>'startDate')::date+make_interval(months=>$4))::date;
 select * into existing from public.subscription_payment_reports where plan_id=share.plan_id and member_id=share.member_id and cycle_id=$2;
 if existing.reported_at is not null and existing.confirmed_at is null then return jsonb_build_object('reported',true); end if;
 insert into public.subscription_payment_reports(plan_id,owner_id,member_id,cycle_id,term_months,amount_minor,coverage_end) values(share.plan_id,share.owner_id,share.member_id,$2,$4,quoted,quote_end)
 on conflict(plan_id,member_id,cycle_id) do update set term_months=$4,amount_minor=quoted,coverage_end=quote_end,
 payment_opened_at=case when subscription_payment_reports.term_months=$4 and subscription_payment_reports.confirmed_at is null then subscription_payment_reports.payment_opened_at else null end,
 reported_at=null,confirmed_at=null;
 if $3='preference' then update public.subscription_payment_reports set preference_at=now() where plan_id=share.plan_id and member_id=share.member_id and cycle_id=$2;
 elsif $3='opened' then update public.subscription_payment_reports set payment_opened_at=now() where plan_id=share.plan_id and member_id=share.member_id and cycle_id=$2;
 elsif $3='paid' then
  update public.subscription_payment_reports set reported_at=now() where plan_id=share.plan_id and member_id=share.member_id and cycle_id=$2 and payment_opened_at<=now()-interval '10 seconds';
  if not found then raise exception 'Open payment and wait 10 seconds'; end if;
 else raise exception 'Invalid action'; end if;
 return jsonb_build_object('reported',$3='paid','amountMinor',quoted,'coverageEnd',quote_end);
end $$;
revoke all on function public.report_subscription_coverage(text,uuid,text,integer) from public;
grant execute on function public.report_subscription_coverage(text,uuid,text,integer) to anon,authenticated;

alter table public.subscription_shares add column if not exists preferred_months integer check(preferred_months in (1,3,6,12));
create or replace function public.approve_subscription_coverage(plan_id uuid,member_id uuid,cycle_id uuid,months integer) returns boolean language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
begin
 if $4 is null or $4 not in(1,3,6,12) then return false;end if;
 update public.subscription_payment_reports set approved_months=$4 where plan_id=$1 and member_id=$2 and cycle_id=$3 and owner_id=auth.uid() and term_months=$4;
 if not found then return false;end if;
 update public.subscription_shares set preferred_months=$4 where plan_id=$1 and member_id=$2 and owner_id=auth.uid();
 return found;
end $$;
revoke all on function public.approve_subscription_coverage(uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.approve_subscription_coverage(uuid,uuid,uuid,integer) to authenticated;

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
    'member', jsonb_strip_nulls(jsonb_build_object('id', m.value->>'id', 'name', m.value->>'name', 'joinedDate', m.value->>'joinedDate', 'preferredMonths',s.preferred_months)),
    'groupMembers', coalesce((select jsonb_agg(jsonb_build_object('firstName',split_part(regexp_replace(btrim(gm.value->>'name'),'[[:space:]]+',' ','g'),' ',1))) from jsonb_array_elements(p.document->'members') gm(value) where gm.value->>'active'='true'),'[]'::jsonb),
    'credits', coalesce((select jsonb_agg(jsonb_build_object('id',credit.value->>'id','amountMinor',credit.value->'amountMinor','remainingMinor',credit.value->'remainingMinor','currency',credit.value->>'currency','date',credit.value->>'date','startDate',credit.value->>'startDate','endDate',credit.value->>'endDate')) from jsonb_array_elements(coalesce(p.document->'credits','[]'::jsonb)) credit(value) where credit.value->>'memberId'=s.member_id::text),'[]'::jsonb),
    'cycles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.value->>'id',
        'startDate', c.value->>'startDate',
        'dueDate', c.value->>'dueDate',
        'renewalDate', c.value->>'renewalDate',
        'currency', c.value->>'currency',
        'reportedAt', (select reported_at from public.subscription_payment_reports r where r.plan_id=s.plan_id and r.member_id=s.member_id and r.cycle_id=(c.value->>'id')::uuid and r.confirmed_at is null),
        'coverage', (select jsonb_build_object('months',term_months,'amountMinor',amount_minor,'endDate',coverage_end,'requestedAt',preference_at,'approvedMonths',approved_months) from public.subscription_payment_reports r where r.plan_id=s.plan_id and r.member_id=s.member_id and r.cycle_id=(c.value->>'id')::uuid and r.confirmed_at is null),
        'amountMinor', a.value->'amountMinor',
        'payments', coalesce((
          select jsonb_agg(jsonb_build_object('amountMinor', payment.value->'amountMinor', 'date', payment.value->>'date','sourceCreditId',payment.value->>'sourceCreditId') order by payment.ordinality)
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
  where (s.token_hash = $1 or s.code_hash=$1) and $1 ~ '^[0-9a-f]{64}$'
    and m.value->>'id' = s.member_id::text
    and exists (select 1 from public.resume_admins ra where ra.user_id = s.owner_id)
  limit 1;
$$;
revoke all on function public.get_subscription_share(text) from public;
grant execute on function public.get_subscription_share(text) to anon, authenticated;

-- Private group invitations reveal first names only; join requests require owner approval.
alter table public.subscription_plans add column if not exists group_code text unique check(group_code is null or group_code ~ '^[A-Za-z0-9_-]{22}$');
alter table public.subscription_plans add column if not exists group_hash text unique check(group_hash is null or group_hash ~ '^[0-9a-f]{64}$');
create table if not exists public.subscription_join_requests(
 id uuid primary key default gen_random_uuid(),plan_id uuid not null,owner_id uuid not null,
 name text not null check(length(name) between 1 and 80),email text not null check(length(email) between 3 and 254),
 status text not null default 'pending' check(status in('pending','approved','declined')),member_id uuid,created_at timestamptz not null default now(),
 unique(plan_id,email),foreign key(plan_id,owner_id) references public.subscription_plans(id,owner_id) on delete cascade
);
alter table public.subscription_join_requests enable row level security;
drop policy if exists "join request owner" on public.subscription_join_requests;
create policy "join request owner" on public.subscription_join_requests for all to authenticated using(owner_id=auth.uid() and public.is_resume_admin()) with check(owner_id=auth.uid() and public.is_resume_admin());
revoke all on public.subscription_join_requests from public,anon,authenticated;
grant select,update on public.subscription_join_requests to authenticated;
create or replace function public.get_subscription_group(invite_hash text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',p.document->'plan'->>'name','members',coalesce((select jsonb_agg(jsonb_build_object('firstName',split_part(regexp_replace(btrim(m.value->>'name'),'[[:space:]]+',' ','g'),' ',1))) from jsonb_array_elements(p.document->'members') m(value) where m.value->>'active'='true'),'[]'::jsonb))
 from public.subscription_plans p where p.group_hash=$1 and $1 ~ '^[0-9a-f]{64}$' and exists(select 1 from public.resume_admins where user_id=p.owner_id) limit 1;
$$;
revoke all on function public.get_subscription_group(text) from public;
grant execute on function public.get_subscription_group(text) to anon,authenticated;
create or replace function public.request_subscription_join(invite_hash text,request_name text,request_email text) returns boolean language plpgsql security definer set search_path='' as $$
declare plan public.subscription_plans;
begin
 if length(btrim($2)) not between 1 and 80 or length($3)>254 or $3 !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid name and email';end if;
 select p.* into plan from public.subscription_plans p where p.group_hash=$1 and exists(select 1 from public.resume_admins where user_id=p.owner_id) for update;
 if plan.id is null then raise exception 'Invalid invitation';end if;
 if (select count(*) from public.subscription_join_requests where plan_id=plan.id and status='pending')>=50 then raise exception 'This group is not accepting more requests right now';end if;
 insert into public.subscription_join_requests(plan_id,owner_id,name,email) values(plan.id,plan.owner_id,btrim($2),lower(btrim($3))) on conflict(plan_id,email) do nothing;
 return true;
end $$;
revoke all on function public.request_subscription_join(text,text,text) from public;
grant execute on function public.request_subscription_join(text,text,text) to anon,authenticated;
create or replace function public.review_subscription_join(request_id uuid,approve boolean) returns uuid language plpgsql security invoker set search_path='' as $$
declare request public.subscription_join_requests;plan public.subscription_plans;new_member uuid;
begin
 select r.* into request from public.subscription_join_requests r where r.id=$1 and r.owner_id=auth.uid() for update;
 if request.id is null or request.status<>'pending' then raise exception 'Request changed or is unavailable';end if;
 if not $2 then update public.subscription_join_requests set status='declined' where id=$1;return null;end if;
 select p.* into plan from public.subscription_plans p where p.id=request.plan_id and p.owner_id=auth.uid() for update;
 if plan.id is null or jsonb_array_length(plan.document->'members')>=50 then raise exception 'Member limit reached';end if;
 new_member=gen_random_uuid();
 update public.subscription_plans set document=jsonb_set(document,'{members}',(document->'members')||jsonb_build_array(jsonb_build_object('id',new_member,'name',request.name,'active',true,'joinedDate',to_char(now() at time zone 'Asia/Kolkata','YYYY-MM-DD')))),revision=revision+1 where id=plan.id and owner_id=auth.uid();
 if not found then raise exception 'Not allowed';end if;
 update public.subscription_join_requests set status='approved',member_id=new_member where id=$1;
 return new_member;
end $$;
revoke all on function public.review_subscription_join(uuid,boolean) from public,anon;
grant execute on function public.review_subscription_join(uuid,boolean) to authenticated;
