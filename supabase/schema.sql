-- LabFlow 2회차: 연구 프로젝트 저장 구조
-- Supabase Dashboard > SQL Editor에서 한 번 실행하세요.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
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

grant select, insert, update on table public.projects to anon, authenticated;

drop policy if exists "demo projects can be read" on public.projects;
create policy "demo projects can be read"
on public.projects for select
to anon, authenticated
using (true);

drop policy if exists "demo projects can be created" on public.projects;
create policy "demo projects can be created"
on public.projects for insert
to anon, authenticated
with check (true);

drop policy if exists "demo projects can be updated" on public.projects;
create policy "demo projects can be updated"
on public.projects for update
to anon, authenticated
using (true)
with check (true);

-- 현재 사이트가 비공개인 수업용 1차 버전에 한해 사용하는 정책입니다.
-- 공개 배포 전에는 Supabase Auth와 user_id 기반 정책으로 교체해야 합니다.

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
grant select, insert, update on public.protocols to anon, authenticated;
grant select, insert, update, delete on public.research_events to anon, authenticated;

drop policy if exists "demo protocols read" on public.protocols;
create policy "demo protocols read" on public.protocols for select to anon, authenticated using (true);
drop policy if exists "demo protocols insert" on public.protocols;
create policy "demo protocols insert" on public.protocols for insert to anon, authenticated with check (true);
drop policy if exists "demo protocols update" on public.protocols;
create policy "demo protocols update" on public.protocols for update to anon, authenticated using (true) with check (true);

drop policy if exists "demo events read" on public.research_events;
create policy "demo events read" on public.research_events for select to anon, authenticated using (true);
drop policy if exists "demo events insert" on public.research_events;
create policy "demo events insert" on public.research_events for insert to anon, authenticated with check (true);
drop policy if exists "demo events update" on public.research_events;
create policy "demo events update" on public.research_events for update to anon, authenticated using (true) with check (true);
drop policy if exists "demo events delete" on public.research_events;
create policy "demo events delete" on public.research_events for delete to anon, authenticated using (true);
