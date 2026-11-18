-- Disposable fictional test data only. No Supabase Auth users or personal tables are referenced.
create schema if not exists automation_lab;
create table if not exists automation_lab.workspaces(
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 document jsonb not null check(jsonb_typeof(document)='object' and document->>'version'='1' and octet_length(document::text)<=400000),
 revision integer not null default 1 check(revision>0),
 expires_at timestamptz not null default (now()+interval '24 hours')
);
create index if not exists lab_workspace_expiry on automation_lab.workspaces(expires_at);
alter table automation_lab.workspaces enable row level security;
revoke all on automation_lab.workspaces from public,anon,authenticated;
drop policy if exists "deny direct lab access" on automation_lab.workspaces;
create policy "deny direct lab access" on automation_lab.workspaces for all using(false) with check(false);
create or replace function automation_lab.manage_workspace(operation text,capability_hash text,new_document jsonb default null,expected_revision integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row_data automation_lab.workspaces; result jsonb;
begin
 if capability_hash is null or capability_hash !~ '^[a-f0-9]{64}$' then raise exception 'LAB_TOKEN'; end if;
 if operation='create' then
  perform pg_catalog.pg_advisory_xact_lock(772401);
  delete from automation_lab.workspaces where expires_at<=now();
  if (select count(*) from automation_lab.workspaces)>=200 then raise exception 'LAB_CAPACITY'; end if;
  insert into automation_lab.workspaces(token_hash,document) values(capability_hash,new_document) returning * into row_data;
 elsif operation='read' then
  select * into row_data from automation_lab.workspaces where token_hash=capability_hash and expires_at>now();
 elsif operation='save' then
  update automation_lab.workspaces set document=new_document,revision=revision+1 where token_hash=capability_hash and expires_at>now() and revision=expected_revision returning * into row_data;
  if not found then raise exception 'LAB_CONFLICT'; end if;
 elsif operation='delete' then
  delete from automation_lab.workspaces where token_hash=capability_hash;
  return jsonb_build_object('deleted',true);
 else raise exception 'LAB_OPERATION'; end if;
 if row_data.token_hash is null then raise exception 'LAB_NOT_FOUND'; end if;
 return jsonb_build_object('document',row_data.document,'revision',row_data.revision,'expiresAt',row_data.expires_at);
end;$$;
revoke all on function automation_lab.manage_workspace(text,text,jsonb,integer) from public;
grant usage on schema automation_lab to anon,authenticated;
grant execute on function automation_lab.manage_workspace(text,text,jsonb,integer) to anon,authenticated;
-- Invoker wrapper exposes only the capability-checked gateway, never table access.
create or replace function public.lab_workspace_gateway(operation text,capability_hash text,new_document jsonb default null,expected_revision integer default null)
returns jsonb language sql security invoker set search_path='' as $$select automation_lab.manage_workspace(operation,capability_hash,new_document,expected_revision);$$;
revoke all on function public.lab_workspace_gateway(text,text,jsonb,integer) from public;
grant execute on function public.lab_workspace_gateway(text,text,jsonb,integer) to anon,authenticated;
