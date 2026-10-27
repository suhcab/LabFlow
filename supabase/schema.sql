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

