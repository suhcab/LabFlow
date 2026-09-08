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
