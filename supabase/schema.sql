-- LabFlow 2회차: 연구 프로젝트 저장 구조
-- Supabase Dashboard > SQL Editor에서 한 번 실행하세요.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  title text not null check (char_length(title) between 1 and 120),
  topic text not null default '',
  field text not null default '기타',
  status text not null default '계획 중'
    check (status in ('계획 중', '진행 중', '완료')),
  start_date date,
  due_date date,
  progress smallint not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

grant select, insert, update on table public.projects to authenticated;

drop policy if exists "demo projects can be read" on public.projects;
create policy "demo projects can be read"
on public.projects for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "demo projects can be created" on public.projects;
create policy "demo projects can be created"
on public.projects for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "demo projects can be updated" on public.projects;
create policy "demo projects can be updated"
on public.projects for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- 로그인한 사용자만 자신의 연구 기록을 조회하고 수정할 수 있습니다.

-- 3차시: 프로젝트별 프로토콜과 연구 일정
create table if not exists public.protocols (
  project_id uuid primary key references public.projects(id) on delete cascade,
  purpose text not null default '',
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  event_date date not null,
  event_time text not null default '' check (event_time = '' or event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  kind text not null default '실험' check (kind in ('실험', '분석', '제출', '기타')),
  notes text not null default '',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_events_project_date_idx on public.research_events(project_id, event_date);
alter table public.protocols enable row level security;
alter table public.research_events enable row level security;
grant select, insert, update on public.protocols to authenticated;
grant select, insert, update, delete on public.research_events to authenticated;

drop policy if exists "demo protocols read" on public.protocols;
create policy "demo protocols read" on public.protocols for select to authenticated using (exists (select 1 from public.projects where projects.id = protocols.project_id and projects.user_id = (select auth.uid())));
drop policy if exists "demo protocols insert" on public.protocols;
create policy "demo protocols insert" on public.protocols for insert to authenticated with check (exists (select 1 from public.projects where projects.id = protocols.project_id and projects.user_id = (select auth.uid())));
drop policy if exists "demo protocols update" on public.protocols;
create policy "demo protocols update" on public.protocols for update to authenticated using (exists (select 1 from public.projects where projects.id = protocols.project_id and projects.user_id = (select auth.uid()))) with check (exists (select 1 from public.projects where projects.id = protocols.project_id and projects.user_id = (select auth.uid())));

drop policy if exists "demo events read" on public.research_events;
create policy "demo events read" on public.research_events for select to authenticated using (exists (select 1 from public.projects where projects.id = research_events.project_id and projects.user_id = (select auth.uid())));
drop policy if exists "demo events insert" on public.research_events;
create policy "demo events insert" on public.research_events for insert to authenticated with check (exists (select 1 from public.projects where projects.id = research_events.project_id and projects.user_id = (select auth.uid())));
drop policy if exists "demo events update" on public.research_events;
create policy "demo events update" on public.research_events for update to authenticated using (exists (select 1 from public.projects where projects.id = research_events.project_id and projects.user_id = (select auth.uid()))) with check (exists (select 1 from public.projects where projects.id = research_events.project_id and projects.user_id = (select auth.uid())));
drop policy if exists "demo events delete" on public.research_events;
create policy "demo events delete" on public.research_events for delete to authenticated using (exists (select 1 from public.projects where projects.id = research_events.project_id and projects.user_id = (select auth.uid())));

create index if not exists projects_user_id_idx on public.projects(user_id);
revoke all on public.projects, public.protocols, public.research_events from anon;


-- Research tools added 2026-10-27
-- Additive migration: preserve existing projects, protocols, events and accounts.
begin;
create table if not exists public.research_designs (
  project_id uuid primary key references public.projects(id) on delete cascade,
  design jsonb not null default '{}'::jsonb check (jsonb_typeof(design) = 'object'),
  updated_at timestamptz not null default now()
);
create table if not exists public.research_datasets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  quantity text not null check (char_length(trim(quantity)) between 1 and 120),
  unit text not null check (char_length(trim(unit)) between 1 and 80),
  "values" jsonb not null check (jsonb_typeof("values") = 'array' and jsonb_array_length("values") between 1 and 10000 and not jsonb_path_exists("values", '$[*] ? (@.type() != "number")')),
  exclusions jsonb not null default '{}'::jsonb check (jsonb_typeof(exclusions) = 'object'),
  resolution double precision not null default 0 check (resolution >= 0 and resolution < 'Infinity'::float8),
  coverage_factor double precision not null default 2 check (coverage_factor > 0 and coverage_factor < 'Infinity'::float8),
  conditions text not null default '', notes text not null default '', run_date date not null,
  protocol_snapshot jsonb check (protocol_snapshot is null or jsonb_typeof(protocol_snapshot) = 'object'),
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists research_datasets_project_idx on public.research_datasets(project_id, updated_at desc);
alter table public.research_designs enable row level security;
alter table public.research_datasets enable row level security;
revoke all on public.research_designs, public.research_datasets from anon;
grant select, insert, update on public.research_designs, public.research_datasets to authenticated;
drop policy if exists "owners manage design" on public.research_designs;
create policy "owners manage design" on public.research_designs for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
drop policy if exists "owners manage datasets" on public.research_datasets;
create policy "owners manage datasets" on public.research_datasets for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
notify pgrst, 'reload schema';
commit;

-- Session 5: explicit invitation-based project editing, revision guards and audit history.
-- Additive: existing projects and all research records are preserved.
begin;
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  primary key(project_id,user_id)
);
create table if not exists public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '7 days'),
  accepted_by uuid references auth.users(id), accepted_at timestamptz,
  revoked_at timestamptz
);
create table if not exists public.project_history (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id), actor_email text,
  occurred_at timestamptz not null default clock_timestamp(),
  record_type text not null, record_id text not null, action text not null,
  changed_fields text[] not null, before_data jsonb, after_data jsonb
);
create index if not exists project_history_project_idx on public.project_history(project_id,id desc);
create index if not exists project_members_user_idx on public.project_members(user_id,project_id);
alter table public.project_members enable row level security;
alter table public.project_invitations enable row level security;
alter table public.project_history enable row level security;
revoke all on public.project_members,public.project_invitations,public.project_history from anon,authenticated;
grant select on public.project_members,public.project_history to authenticated;
grant select(id,project_id,created_by,created_at,expires_at,accepted_by,accepted_at,revoked_at) on public.project_invitations to authenticated;

create or replace function public.is_project_owner(p_project uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
  select auth.uid() is not null and exists(select 1 from public.projects where id=p_project and user_id=auth.uid())
$$;
create or replace function public.can_edit_project(p_project uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
  select auth.uid() is not null and (public.is_project_owner(p_project) or exists(select 1 from public.project_members where project_id=p_project and user_id=auth.uid()))
$$;
revoke all on function public.is_project_owner(uuid),public.can_edit_project(uuid) from public,anon;
grant execute on function public.is_project_owner(uuid),public.can_edit_project(uuid) to authenticated;

drop policy if exists "members see team" on public.project_members;
create policy "members see team" on public.project_members for select to authenticated using(public.can_edit_project(project_id));
drop policy if exists "owners see invitations" on public.project_invitations;
create policy "owners see invitations" on public.project_invitations for select to authenticated using(public.is_project_owner(project_id));
drop policy if exists "members see history" on public.project_history;
create policy "members see history" on public.project_history for select to authenticated using(public.can_edit_project(project_id));

-- Replace previous owner-only policies with project-scoped membership policies.
drop policy if exists "demo projects can be read" on public.projects;
drop policy if exists "demo projects can be created" on public.projects;
drop policy if exists "demo projects can be updated" on public.projects;
drop policy if exists "team projects read" on public.projects;
drop policy if exists "team projects insert" on public.projects;
drop policy if exists "team projects update" on public.projects;
create policy "team projects read" on public.projects for select to authenticated using(public.can_edit_project(id));
create policy "team projects insert" on public.projects for insert to authenticated with check(user_id=auth.uid());
create policy "team projects update" on public.projects for update to authenticated using(public.can_edit_project(id)) with check(public.can_edit_project(id));
drop policy if exists "demo protocols read" on public.protocols;
drop policy if exists "demo protocols insert" on public.protocols;
drop policy if exists "demo protocols update" on public.protocols;
drop policy if exists "demo events read" on public.research_events;
drop policy if exists "demo events insert" on public.research_events;
drop policy if exists "demo events update" on public.research_events;
drop policy if exists "demo events delete" on public.research_events;
drop policy if exists "owners manage design" on public.research_designs;
drop policy if exists "owners manage datasets" on public.research_datasets;
do $$ declare t text; begin
  foreach t in array array['protocols','research_events','research_designs','research_datasets'] loop
    execute format('drop policy if exists "team records" on public.%I',t);
    execute format('create policy "team records" on public.%I for all to authenticated using(public.can_edit_project(project_id)) with check(public.can_edit_project(project_id))',t);
  end loop;
end $$;

-- Every write carries the last-read row revision. Stale/legacy clients cannot overwrite it.
create or replace function public.guard_research_revision() returns trigger
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
  if TG_OP='UPDATE' then
    if new.revision <> old.revision+1 then raise exception 'LABFLOW_CONFLICT: another editor saved this record; reload before retrying' using errcode='40001'; end if;
    if tg_table_name='projects' then
      if new.id<>old.id or new.user_id<>old.user_id then raise exception 'Project ownership cannot be changed' using errcode='42501'; end if;
    else
      if new.project_id<>old.project_id then raise exception 'Records cannot be moved between projects' using errcode='42501'; end if;
      if tg_table_name in ('research_events','research_datasets') then
        if new.id<>old.id then raise exception 'Record ID cannot change' using errcode='42501'; end if;
      end if;
    end if;
  else
    if new.revision<>0 then raise exception 'LABFLOW_CONFLICT: reload the record before saving' using errcode='40001'; end if;
  end if;
  if tg_table_name='research_designs' then
    if (TG_OP='INSERT' and new.design->>'project_deleted_at' is not null) or (TG_OP='UPDATE' and (new.design->>'project_deleted_at') is distinct from (old.design->>'project_deleted_at')) then
      if not public.is_project_owner(new.project_id) then raise exception 'Only the owner can trash or restore a project' using errcode='42501'; end if;
    end if;
  end if;
  new.updated_at=clock_timestamp();
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['projects','protocols','research_events','research_designs','research_datasets'] loop
    execute format('alter table public.%I add column if not exists revision integer not null default 0 check(revision>=0)',t);
    execute format('drop trigger if exists research_revision_guard on public.%I',t);
    execute format('create trigger research_revision_guard before insert or update on public.%I for each row execute function public.guard_research_revision()',t);
  end loop;
end $$;

create or replace function public.log_project_change() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b jsonb; a jsonb; pid uuid; rid text; fields text[]; who text;
begin
  if TG_OP<>'INSERT' then b=to_jsonb(old)-array['updated_at','revision','token_hash']; end if;
  if TG_OP<>'DELETE' then a=to_jsonb(new)-array['updated_at','revision','token_hash']; end if;
  pid=case when tg_table_name='projects' then coalesce(a,b)->>'id' else coalesce(a,b)->>'project_id' end;
  -- A privileged permanent project deletion cascades to children and history.
  if not exists(select 1 from public.projects where id=pid) then
    if TG_OP='DELETE' then return old; else return new; end if;
  end if;
  rid=coalesce(a->>'id',b->>'id',a->>'user_id',b->>'user_id',pid::text);
  select coalesce(array_agg(k order by k),array[]::text[]) into fields from (select jsonb_object_keys(coalesce(a,'{}'::jsonb)||coalesce(b,'{}'::jsonb)) k) s where (a->k) is distinct from (b->k);
  if cardinality(fields)=0 then return coalesce(new,old); end if;
  select email into who from auth.users where id=auth.uid();
  insert into public.project_history(project_id,actor_id,actor_email,record_type,record_id,action,changed_fields,before_data,after_data)
  values(pid,auth.uid(),who,tg_table_name,rid,TG_OP,fields,b,a);
  return coalesce(new,old);
end $$;
do $$ declare t text; begin
  foreach t in array array['projects','protocols','research_events','research_designs','research_datasets','project_members','project_invitations'] loop
    execute format('drop trigger if exists project_change_log on public.%I',t);
    execute format('create trigger project_change_log after insert or update or delete on public.%I for each row execute function public.log_project_change()',t);
  end loop;
end $$;
revoke all on function public.guard_research_revision(),public.log_project_change() from public,anon,authenticated;

create or replace function public.create_project_invitation(p_project uuid) returns text
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare token text;
begin
  if not public.is_project_owner(p_project) then raise exception 'Only the project owner can invite' using errcode='42501'; end if;
  if (select count(*) from public.project_invitations where project_id=p_project and accepted_at is null and revoked_at is null and expires_at>now())>=20 then raise exception 'Revoke old invitations first (maximum 20 active invitations)'; end if;
  token=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into public.project_invitations(project_id,token_hash,created_by) values(p_project,encode(sha256(convert_to(token,'UTF8')),'hex'),auth.uid());
  return token;
end $$;
create or replace function public.accept_project_invitation(p_token text) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare invite public.project_invitations;
begin
  if auth.uid() is null or length(p_token)<>64 then raise exception 'Invalid invitation' using errcode='42501'; end if;
  select * into invite from public.project_invitations where token_hash=encode(sha256(convert_to(trim(p_token),'UTF8')),'hex') and accepted_at is null and revoked_at is null and expires_at>now() for update;
  if not found then raise exception 'Invitation is invalid, expired, revoked or already used' using errcode='42501'; end if;
  if public.can_edit_project(invite.project_id) then raise exception 'Already a project member'; end if;
  if exists(select 1 from public.research_designs where project_id=invite.project_id and design->>'project_deleted_at' is not null) then raise exception 'Project is in the trash'; end if;
  insert into public.project_members(project_id,user_id) values(invite.project_id,auth.uid());
  update public.project_invitations set accepted_by=auth.uid(),accepted_at=now() where id=invite.id;
  return invite.project_id;
end $$;
create or replace function public.revoke_project_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare pid uuid;
begin
  select project_id into pid from public.project_invitations where id=p_invitation;
  if not public.is_project_owner(pid) then raise exception 'Only the owner can revoke' using errcode='42501'; end if;
  update public.project_invitations set revoked_at=now() where id=p_invitation and accepted_at is null and revoked_at is null;
end $$;
create or replace function public.remove_project_member(p_project uuid,p_user uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if not public.is_project_owner(p_project) then raise exception 'Only the owner can remove members' using errcode='42501'; end if;
  delete from public.project_members where project_id=p_project and user_id=p_user;
end $$;
create or replace function public.list_project_team(p_project uuid) returns table(user_id uuid,email text,role text,joined_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if not public.can_edit_project(p_project) then raise exception 'Project access denied' using errcode='42501'; end if;
  return query select u.id,u.email::text,'owner'::text,p.created_at from public.projects p join auth.users u on u.id=p.user_id where p.id=p_project
    union all select u.id,u.email::text,'editor'::text,m.joined_at from public.project_members m join auth.users u on u.id=m.user_id where m.project_id=p_project;
end $$;
revoke all on function public.create_project_invitation(uuid),public.accept_project_invitation(text),public.revoke_project_invitation(uuid),public.remove_project_member(uuid,uuid),public.list_project_team(uuid) from public,anon;
grant execute on function public.create_project_invitation(uuid),public.accept_project_invitation(text),public.revoke_project_invitation(uuid),public.remove_project_member(uuid,uuid),public.list_project_team(uuid) to authenticated;
notify pgrst,'reload schema';
commit;


